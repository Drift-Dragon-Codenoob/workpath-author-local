import { createWidgetBlock, findWidgetDefinition, renderContentBlock, validateBlock } from "./widgets.js";
import type { ContentBlock } from "./schema.js";

export const STORYBOARD_BLOCK_TYPES = ["Rich text", "Note / callout", "Accordion", "Checklist", "Quote", "Image", "Image + text", "Table", "Card grid", "Responsive columns", "Resource link card", "Styled list group", "Code snippet", "True or false", "Single-answer knowledge check", "Multiple-answer knowledge check", "Flip cards", "Hotspot image", "Custom HTML", "Image gallery / carousel", "Video embed"] as const;
export type StoryboardBlockType = typeof STORYBOARD_BLOCK_TYPES[number];
export type StoryboardRowInput = { topic: string; order: number | string; blockType: string; content: string; mapping: string; settingsJson: string };
export type StoryboardMessage = { row: number; severity: "error" | "warning"; message: string };
export type VerifiedStoryboardRow = { row: number; order: number; blockType: StoryboardBlockType; content: string; mapping: string; settingsJson: string; block?: ContentBlock; previewHtml: string };
export type StoryboardVerification = { title: string; rows: VerifiedStoryboardRow[]; messages: StoryboardMessage[]; valid: boolean };

const widgetKeys: Record<Exclude<StoryboardBlockType, "Rich text">, string> = { "Note / callout": "note", Accordion: "accordion", Checklist: "checklist", Quote: "quote", Image: "image", "Image + text": "image-text", Table: "table", "Card grid": "card-grid", "Responsive columns": "responsive-columns", "Resource link card": "resource-card", "Styled list group": "list-group", "Code snippet": "code-snippet", "True or false": "true-false", "Single-answer knowledge check": "single-choice", "Multiple-answer knowledge check": "multiple-choice", "Flip cards": "flip-cards", "Hotspot image": "hotspot-image", "Custom HTML": "custom-html", "Image gallery / carousel": "image-gallery", "Video embed": "video-embed" };
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function markdownToHtml(markdown: string) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) output.push(`</${list}>`); list = null; };
  const inline = (value: string) => escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*]\s+(.+)$/); const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) { const next = bullet ? "ul" : "ol"; if (list !== next) { closeList(); list = next; output.push(`<${next}>`); } output.push(`<li>${inline((bullet ?? numbered)![1]!)}</li>`); continue; }
    closeList();
    if (!line) continue;
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { const level = Math.min(4, heading[1]!.length + 1); output.push(`<h${level}>${inline(heading[2]!)}</h${level}>`); }
    else output.push(`<p>${inline(line)}</p>`);
  }
  closeList(); return output.join("\n") || "<p></p>";
}

export function htmlToMarkdown(html: string) {
  return html
    .replace(/<h([1-4])[^>]*>(.*?)<\/h\1>/gis, (_, level: string, text: string) => `${"#".repeat(Math.max(1, Number(level) - 1))} ${stripHtml(text)}\n\n`)
    .replace(/<li[^>]*>(.*?)<\/li>/gis, (_, text: string) => `- ${stripHtml(text)}\n`)
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, "**$1**").replace(/<b[^>]*>(.*?)<\/b>/gis, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gis, "*$1*").replace(/<i[^>]*>(.*?)<\/i>/gis, "*$1*")
    .replace(/<p[^>]*>(.*?)<\/p>/gis, (_, text: string) => `${stripHtml(text)}\n\n`).replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n").trim();
}

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
const boldSegments = (content: string) => [...content.matchAll(/\*\*(.+?)\*\*\s*([\s\S]*?)(?=\n\s*\*\*|$)/g)].map((match) => ({ title: match[1]!.trim(), body: match[2]!.trim() }));
const labelled = (content: string, label: string) => content.match(new RegExp(`\\*\\*${label}:?\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[^*]+:?\\*\\*|$)`, "i"))?.[1]?.trim() ?? "";

function blockFromRow(type: StoryboardBlockType, content: string, mapping: string, settingsJson: string): ContentBlock {
  let settings: Record<string, unknown> = {};
  if (settingsJson.trim()) { const parsed: unknown = JSON.parse(settingsJson); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Settings JSON must contain an object."); settings = parsed as Record<string, unknown>; }
  const metadata = { ...(mapping.trim() ? { mapping: mapping.trim() } : {}), ...(typeof settings.imagePrompt === "string" ? { imagePrompt: settings.imagePrompt } : {}) };
  if (type === "Rich text") return { id: crypto.randomUUID(), type: "richText", html: typeof settings.html === "string" ? settings.html : markdownToHtml(content), metadata };
  const block = createWidgetBlock(widgetKeys[type]);
  if (settings.params && typeof settings.params === "object" && !Array.isArray(settings.params)) block.params = structuredClone(settings.params as Record<string, unknown>);
  else block.params = inferredParams(type, content, block.params, metadata);
  if (typeof settings.definitionVersion === "string") block.definitionVersion = settings.definitionVersion;
  block.metadata = metadata;
  return block;
}

function inferredParams(type: Exclude<StoryboardBlockType, "Rich text">, content: string, defaults: Record<string, unknown>, metadata: { mapping?: string; imagePrompt?: string }) {
  const segments = boldSegments(content); const params = structuredClone(defaults);
  if (type === "Note / callout") { params.title = segments[0]?.title ?? "Note"; params.html = markdownToHtml(segments[0]?.body || content.replace(/^\*\*.+?\*\*/, "").trim()); }
  if (type === "Accordion") { const title = segments[0]?.title; params.sections = (title ? segments.slice(1) : segments).map((section) => ({ title: section.title, body: markdownToHtml(section.body) })); }
  if (type === "Checklist") { const items = content.split("\n").map((line) => line.trim()).filter((line) => /^[-*]\s+/.test(line)).map((line) => ({ text: line.replace(/^[-*]\s+/, "") })); params.title = content.split("\n").find((line) => line.trim() && !/^[-*]\s+/.test(line))?.replaceAll("**", "") ?? "Checklist"; params.items = items; }
  if (type === "Quote") { const lines = content.split("\n").filter((line) => line.trim()); const attribution = lines.find((line) => /^[-—]\s*/.test(line)); params.text = markdownToHtml(lines.filter((line) => line !== attribution).join("\n")); params.attribution = attribution?.replace(/^[-—]\s*/, "") ?? ""; }
  if (type === "Image" || type === "Image + text") {
    const prompt = labelled(content, "Suggested image"); const altText = labelled(content, "Alternative text"); const caption = labelled(content, "Caption"); metadata.imagePrompt = prompt;
    params.altText = altText; if (type === "Image") params.caption = caption;
    if (type === "Image + text") { params.heading = segments.find((segment) => !["Suggested image", "Alternative text", "Caption"].includes(segment.title))?.title ?? "Image with text"; const body = content.replace(/\*\*(Suggested image|Alternative text|Caption):?\*\*[\s\S]*?(?=\n\s*\*\*[^*]+:?\*\*|$)/gi, ""); params.html = markdownToHtml(body.replace(/^\*\*.+?\*\*/, "").trim()); }
  }
  if (type === "Table") { const table = parseMarkdownTable(content); params.caption = content.split("\n").find((line) => line.trim() && !line.includes("|"))?.replaceAll("**", "") ?? "Table"; params.columns = table.headers.map((heading) => ({ heading })); params.rows = table.rows.map((cells) => ({ cells })); }
  return params;
}

function parseMarkdownTable(content: string) {
  const rows = content.split("\n").filter((line) => line.includes("|")).map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  if (rows.length < 2) return { headers: ["Column 1"], rows: [[""]] };
  const separator = rows[1]!.every((cell) => /^:?-{3,}:?$/.test(cell)); return { headers: rows[0]!, rows: rows.slice(separator ? 2 : 1) };
}

export function verifyStoryboardRows(inputs: StoryboardRowInput[]): StoryboardVerification {
  const messages: StoryboardMessage[] = []; let title = ""; const seenOrders = new Set<number>(); const rows: VerifiedStoryboardRow[] = [];
  inputs.forEach((input, index) => {
    const row = index + 2; if (input.topic.trim()) { if (!title) title = input.topic.trim(); else if (input.topic.trim() !== title) messages.push({ row, severity: "error", message: `Topic must remain “${title}” throughout this workbook.` }); }
    const order = Number(input.order); if (!Number.isInteger(order) || order < 1) messages.push({ row, severity: "error", message: "Block order must be a positive whole number." }); else if (seenOrders.has(order)) messages.push({ row, severity: "error", message: `Block order ${order} is duplicated.` }); else seenOrders.add(order);
    const validType = STORYBOARD_BLOCK_TYPES.find((type) => type === input.blockType.trim());
    if (!validType) { messages.push({ row, severity: "error", message: `Unknown block type “${input.blockType || "blank"}”. Use the workbook dropdown.` }); rows.push({ row, order, blockType: "Rich text", content: input.content, mapping: input.mapping, settingsJson: input.settingsJson, previewHtml: "" }); return; }
    if (!input.content.trim() && !input.settingsJson.trim()) messages.push({ row, severity: "error", message: "Content is required unless Settings JSON provides the complete block." });
    try { const block = blockFromRow(validType, input.content, input.mapping, input.settingsJson); const previewHtml = renderContentBlock(block); if (/<script\b|\son\w+\s*=|javascript\s*:/i.test(previewHtml)) messages.push({ row, severity: "error", message: "Block contains unsafe script or event-handler HTML." }); const imageWarning = (validType === "Image" || validType === "Image + text") && !block.metadata?.imagePrompt ? "Image block has no suggested-image prompt." : ""; if (imageWarning) messages.push({ row, severity: "warning", message: imageWarning }); validateBlock(block).forEach((issue) => messages.push({ row, severity: issue.message === "Choose an image." ? "warning" : "error", message: issue.message })); rows.push({ row, order, blockType: validType, content: input.content, mapping: input.mapping, settingsJson: input.settingsJson, block, previewHtml }); }
    catch (error) { messages.push({ row, severity: "error", message: error instanceof Error ? error.message : "Could not parse block." }); rows.push({ row, order, blockType: validType, content: input.content, mapping: input.mapping, settingsJson: input.settingsJson, previewHtml: "" }); }
  });
  if (!title) messages.push({ row: 2, severity: "error", message: "The first non-empty Topic cell must provide the chapter or subchapter title." });
  if (!inputs.length) messages.push({ row: 2, severity: "error", message: "The storyboard contains no block rows." });
  rows.sort((a, b) => a.order - b.order); return { title, rows, messages, valid: !messages.some((message) => message.severity === "error") };
}

export function storyboardRowFromBlock(title: string, block: ContentBlock, order: number): StoryboardRowInput {
  if (block.type === "richText") return { topic: order === 1 ? title : "", order, blockType: "Rich text", content: htmlToMarkdown(block.html), mapping: block.metadata?.mapping ?? "", settingsJson: JSON.stringify({ html: block.html }) };
  const definition = findWidgetDefinition(block.widgetKey); const blockType = (Object.entries(widgetKeys).find(([, key]) => key === block.widgetKey)?.[0] ?? definition?.name ?? block.widgetKey) as StoryboardBlockType;
  const stripAssetIds = (value: unknown): unknown => Array.isArray(value) ? value.map(stripAssetIds) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, field]) => [key, key.toLowerCase().endsWith("assetid") ? "" : stripAssetIds(field)])) : value;
  const params = stripAssetIds(structuredClone(block.params)) as Record<string, unknown>;
  return { topic: order === 1 ? title : "", order, blockType, content: widgetContent(blockType, block.params, block.metadata?.imagePrompt), mapping: block.metadata?.mapping ?? "", settingsJson: JSON.stringify({ definitionVersion: block.definitionVersion, params, ...(block.metadata?.imagePrompt ? { imagePrompt: block.metadata.imagePrompt } : {}) }) };
}

function widgetContent(type: StoryboardBlockType, params: Record<string, unknown>, imagePrompt = "") {
  if (type === "Note / callout") return `**${String(params.title ?? "Note")}**\n${htmlToMarkdown(String(params.html ?? ""))}`;
  if (type === "Accordion") return (Array.isArray(params.sections) ? params.sections : []).map((section) => { const item = section as Record<string, unknown>; return `**${String(item.title ?? "Section")}**\n${htmlToMarkdown(String(item.body ?? ""))}`; }).join("\n\n");
  if (type === "Checklist") return `${String(params.title ?? "Checklist")}\n\n${(Array.isArray(params.items) ? params.items : []).map((item) => `- ${String((item as Record<string, unknown>).text ?? "")}`).join("\n")}`;
  if (type === "Quote") return `${htmlToMarkdown(String(params.text ?? ""))}${params.attribution ? `\n— ${String(params.attribution)}` : ""}`;
  if (type === "Image") return `**Suggested image:** ${imagePrompt}\n\n**Alternative text:** ${String(params.altText ?? "")}\n\n**Caption:** ${String(params.caption ?? "")}`;
  if (type === "Image + text") return `**${String(params.heading ?? "Image with text")}**\n${htmlToMarkdown(String(params.html ?? ""))}\n\n**Suggested image:** ${imagePrompt}\n\n**Alternative text:** ${String(params.altText ?? "")}`;
  if (type === "Table") { const columns = Array.isArray(params.columns) ? params.columns as Array<Record<string, unknown>> : []; const rows = Array.isArray(params.rows) ? params.rows as Array<Record<string, unknown>> : []; const headings = columns.map((column) => String(column.heading ?? "")); return `${String(params.caption ?? "Table")}\n\n| ${headings.join(" | ")} |\n| ${headings.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${(Array.isArray(row.cells) ? row.cells : []).join(" | ")} |`).join("\n")}`; }
  return "";
}
