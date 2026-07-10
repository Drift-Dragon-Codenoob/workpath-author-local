import Mustache from "mustache";
import type { AssetRecord, ContentBlock, WidgetBlock } from "./schema.js";

export type WidgetParameterType = "textfield" | "richtext" | "select" | "checkbox" | "numeric" | "image" | "repeatable";
export type WidgetParameterOption = string | { label: string; value: string };
export type WidgetParameter = { name: string; title: string; type: WidgetParameterType; default?: unknown; options?: WidgetParameterOption[]; min?: number; max?: number; initial?: number; itemLabel?: string; fields?: WidgetParameter[] };
export type WidgetDefinition = { key: string; name: string; category: string; description: string; version: string; template: string; parameters: WidgetParameter[] };
export type ValidationIssue = { blockId: string; message: string };

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  { key: "note", name: "Note / callout", category: "Content", description: "Highlight a note, tip, warning, or important reminder.", version: "1.1.0", template: `<aside class="workpath-note workpath-note--{{tone}}" style="background:{{noteBackground}};border-left:5px solid {{noteBorder}};border-radius:4px;margin:20px 0;padding:18px 22px"><h3 style="margin-top:0">{{title}}</h3>{{{html}}}</aside>`, parameters: [
    { name: "tone", title: "Tone", type: "select", default: "info", options: ["info", "tip", "warning", "important"] },
    { name: "title", title: "Title", type: "textfield", default: "Note" },
    { name: "html", title: "Body", type: "richtext", default: "<p>Add a short note or reminder.</p>" }
  ] },
  { key: "accordion", name: "Accordion", category: "Interactive", description: "Expandable sections for supporting detail.", version: "1.1.0", template: `<section class="workpath-accordion" style="margin:20px 0">{{#sections}}<details style="border:1px solid #d3dce8;border-radius:5px;margin:8px 0;padding:12px"><summary style="cursor:pointer;font-weight:700">{{title}}</summary><div style="padding-top:10px">{{{body}}}</div></details>{{/sections}}</section>`, parameters: [
    { name: "sections", title: "Sections", type: "repeatable", min: 1, max: 10, initial: 2, itemLabel: "Section", fields: [
      { name: "title", title: "Title", type: "textfield", default: "Section {{i}}" }, { name: "body", title: "Body", type: "richtext", default: "<p>Add section content.</p>" }
    ] }
  ] },
  { key: "checklist", name: "Checklist", category: "Interactive", description: "A clear list of actions or checkpoints.", version: "1.1.0", template: `<section class="workpath-checklist" style="margin:20px 0"><h3>{{title}}</h3><ul style="padding-left:24px">{{#items}}<li style="margin:7px 0">{{text}}</li>{{/items}}</ul></section>`, parameters: [
    { name: "title", title: "Title", type: "textfield", default: "Checklist" },
    { name: "items", title: "Items", type: "repeatable", min: 1, max: 20, initial: 3, itemLabel: "Item", fields: [{ name: "text", title: "Text", type: "textfield", default: "Checklist item {{i}}" }] }
  ] },
  { key: "quote", name: "Quote", category: "Content", description: "A quotation with optional attribution.", version: "1.1.0", template: `<figure class="workpath-quote" style="border-left:4px solid #6f7f95;margin:20px 0;padding:5px 20px"><blockquote style="font-size:1.2rem;margin:0">{{{text}}}</blockquote>{{#attribution}}<figcaption style="color:#647187;margin-top:8px">— {{attribution}}</figcaption>{{/attribution}}</figure>`, parameters: [
    { name: "text", title: "Quote", type: "richtext", default: "<p>Add the quotation.</p>" }, { name: "attribution", title: "Attribution", type: "textfield", default: "" }
  ] },
  { key: "image", name: "Image", category: "Media", description: "An image with required alternative text and an optional caption.", version: "1.2.0", template: `<figure class="workpath-image" style="margin:20px 0;text-align:center">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" loading="lazy" style="border-radius:6px;box-sizing:border-box;display:block;height:auto;margin-left:auto;margin-right:auto;max-width:100%;{{{imageBorderStyle}}}">{{/imageUrl}}{{^imageUrl}}<p class="workpath-missing-media" style="background:#f3f5f8;border:2px dashed #bdc8d6;color:#65728a;padding:28px">Choose an image.</p>{{/imageUrl}}{{#caption}}<figcaption style="color:#65728a;font-size:.88rem;margin-top:7px">{{caption}}</figcaption>{{/caption}}</figure>`, parameters: [
    { name: "imageAssetId", title: "Image", type: "image", default: "" }, { name: "altText", title: "Alternative text", type: "textfield", default: "" }, { name: "caption", title: "Caption", type: "textfield", default: "" }, { name: "showBorder", title: "Show border", type: "checkbox", default: false }
  ] },
  { key: "image-text", name: "Image + text", category: "Media", description: "An image beside a heading and supporting rich text.", version: "1.3.0", template: `<section class="workpath-image-text workpath-image-text--{{position}}" style="margin:20px 0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:0;border-collapse:separate;width:100%"><tbody><tr>{{#imageLeft}}<td width="40%" valign="top" style="border:0;padding:0 24px 0 0;vertical-align:top">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" loading="lazy" width="100%" style="border-radius:6px;box-sizing:border-box;display:block;height:auto;margin-left:auto;margin-right:auto;max-width:100%;{{{imageBorderStyle}}}">{{/imageUrl}}</td>{{/imageLeft}}<td width="60%" valign="top" style="border:0;padding:0;vertical-align:top"><h3 style="margin-top:0">{{heading}}</h3>{{{html}}}</td>{{#imageRight}}<td width="40%" valign="top" style="border:0;padding:0 0 0 24px;vertical-align:top">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" loading="lazy" width="100%" style="border-radius:6px;box-sizing:border-box;display:block;height:auto;margin-left:auto;margin-right:auto;max-width:100%;{{{imageBorderStyle}}}">{{/imageUrl}}</td>{{/imageRight}}</tr></tbody></table></section>`, parameters: [
    { name: "imageAssetId", title: "Image", type: "image", default: "" }, { name: "position", title: "Image position", type: "select", default: "left", options: ["left", "right"] }, { name: "altText", title: "Alternative text", type: "textfield", default: "" }, { name: "showBorder", title: "Show border", type: "checkbox", default: false }, { name: "heading", title: "Heading", type: "textfield", default: "Image with text" }, { name: "html", title: "Body", type: "richtext", default: "<p>Add supporting content.</p>" }
  ] },
  { key: "table", name: "Table", category: "Data", description: "An accessible table with directly editable rows and columns.", version: "1.2.0", template: `<figure class="workpath-table" style="margin:20px 0;overflow-x:auto"><table style="border-collapse:collapse;width:100%"><caption style="font-weight:700;padding:8px;text-align:left">{{caption}}</caption><thead><tr>{{#columns}}<th scope="col" style="background:#eaf0f7;border:1px solid #aebbc9;padding:9px 11px;text-align:left;vertical-align:top">{{heading}}</th>{{/columns}}</tr></thead><tbody>{{#rows}}<tr>{{#cells}}<td style="border:1px solid #aebbc9;padding:9px 11px;text-align:left;vertical-align:top">{{.}}</td>{{/cells}}</tr>{{/rows}}</tbody></table></figure>`, parameters: [
    { name: "caption", title: "Table caption", type: "textfield", default: "Table summary" },
    { name: "columns", title: "Columns", type: "repeatable", min: 1, max: 10, default: [{ heading: "Column 1" }, { heading: "Column 2" }, { heading: "Column 3" }], fields: [{ name: "heading", title: "Heading", type: "textfield", default: "Column {{i}}" }] },
    { name: "rows", title: "Rows", type: "repeatable", min: 1, max: 50, default: [{ cells: ["", "", ""] }, { cells: ["", "", ""] }, { cells: ["", "", ""] }] }
  ] }
];

const definitions = new Map(WIDGET_DEFINITIONS.map((definition) => [definition.key, definition]));
export const findWidgetDefinition = (key: string) => definitions.get(key) ?? null;

function initialValue(parameter: WidgetParameter, index = 1): unknown {
  if (parameter.type === "repeatable") {
    if (Array.isArray(parameter.default)) return structuredClone(parameter.default);
    return Array.from({ length: parameter.initial ?? parameter.min ?? 1 }, (_, itemIndex) => Object.fromEntries((parameter.fields ?? []).map((field) => [field.name, initialValue(field, itemIndex + 1)])));
  }
  return typeof parameter.default === "string" ? parameter.default.replaceAll("{{i}}", String(index)) : parameter.default ?? (parameter.type === "checkbox" ? false : "");
}

export function defaultWidgetParams(definition: WidgetDefinition): Record<string, unknown> {
  return Object.fromEntries(definition.parameters.map((parameter) => [parameter.name, initialValue(parameter)]));
}

export function createWidgetBlock(widgetKey: string): WidgetBlock {
  const definition = findWidgetDefinition(widgetKey);
  if (!definition) throw new Error(`Unknown widget: ${widgetKey}`);
  return { id: crypto.randomUUID(), type: "widget", widgetKey, definitionVersion: definition.version, params: defaultWidgetParams(definition) };
}

export function assetPackagePath(asset: AssetRecord) {
  const safeName = asset.filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "file";
  return `assets/${asset.id}-${safeName}`;
}

function assetContext(value: unknown, assets: AssetRecord[], assetUrl: (asset: AssetRecord) => string): unknown {
  if (Array.isArray(value)) return value.map((entry) => assetContext(entry, assets, assetUrl));
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    next[key] = assetContext(field, assets, assetUrl);
    if (key.toLowerCase().endsWith("assetid") && typeof field === "string") {
      const asset = assets.find((item) => item.id === field);
      next[key.replace(/assetId$/i, "Url")] = asset ? assetUrl(asset) : "";
    }
  }
  return next;
}

export function renderWidgetBlock(block: WidgetBlock, assets: AssetRecord[] = [], assetUrl: (asset: AssetRecord) => string = assetPackagePath): string {
  const definition = findWidgetDefinition(block.widgetKey);
  if (!definition) return block.fallbackHtml || `<aside class="workpath-missing-widget">Missing widget: ${block.widgetKey}</aside>`;
  const context = assetContext(block.params, assets, assetUrl) as Record<string, unknown>;
  const tone = String(context.tone ?? "info");
  const noteColours: Record<string, [string, string]> = { info: ["#eef6ff", "#4b79ad"], tip: ["#ecf8ef", "#3b8b50"], warning: ["#fff7df", "#d49a1d"], important: ["#fff0f0", "#bd3f3f"] };
  [context.noteBackground, context.noteBorder] = noteColours[tone] ?? noteColours.info!;
  const imageRight = context.position === "right";
  context.imageLeft = !imageRight;
  context.imageRight = imageRight;
  context.imageBorderStyle = context.showBorder ? "background:#ffffff;border:1px solid #aebbc9;padding:4px;" : "border:0;padding:0;";
  context.imageOrder = imageRight ? 2 : 1;
  context.textOrder = imageRight ? 1 : 2;
  try { return Mustache.render(definition.template, context); }
  catch { return block.fallbackHtml || `<aside class="workpath-missing-widget">Could not render ${definition.name}.</aside>`; }
}

export function renderContentBlock(block: ContentBlock, assets: AssetRecord[] = [], assetUrl: (asset: AssetRecord) => string = assetPackagePath): string {
  return block.type === "richText" ? block.html : renderWidgetBlock(block, assets, assetUrl);
}

export function validateBlock(block: ContentBlock): ValidationIssue[] {
  if (block.type === "richText") return block.html.trim() ? [] : [{ blockId: block.id, message: "Rich text block is empty." }];
  const definition = findWidgetDefinition(block.widgetKey);
  if (!definition) return [{ blockId: block.id, message: `Widget definition “${block.widgetKey}” is missing.` }];
  const issues: ValidationIssue[] = [];
  for (const parameter of definition.parameters) {
    const value = block.params[parameter.name];
    if (parameter.type === "repeatable" && (!Array.isArray(value) || value.length < (parameter.min ?? 0))) issues.push({ blockId: block.id, message: `${parameter.title} needs at least ${parameter.min ?? 1} item(s).` });
  }
  if (block.widgetKey === "table") {
    const columns = Array.isArray(block.params.columns) ? block.params.columns : [];
    const rows = Array.isArray(block.params.rows) ? block.params.rows : [];
    if (!String(block.params.caption ?? "").trim()) issues.push({ blockId: block.id, message: "A table caption is required for accessibility." });
    if (columns.length < 1) issues.push({ blockId: block.id, message: "Add at least one table column." });
    if (rows.some((row) => !row || typeof row !== "object" || !Array.isArray((row as { cells?: unknown }).cells) || (row as { cells: unknown[] }).cells.length !== columns.length)) issues.push({ blockId: block.id, message: "Every table row must match the column count." });
  }
  if ((block.widgetKey === "image" || block.widgetKey === "image-text") && !block.params.imageAssetId) issues.push({ blockId: block.id, message: "Choose an image." });
  if ((block.widgetKey === "image" || block.widgetKey === "image-text") && !String(block.params.altText ?? "").trim()) issues.push({ blockId: block.id, message: "Alternative text is required." });
  return issues;
}
