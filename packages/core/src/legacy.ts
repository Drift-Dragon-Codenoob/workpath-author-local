import { createProject, defaultTheme, type BookTheme, type Chapter, type ContentBlock, type Subchapter, type WorkPathProject } from "./schema.js";
import { findWidgetDefinition } from "./widgets.js";

type RecordValue = Record<string, unknown>;

export type LegacyImportResult = {
  project: WorkPathProject;
  warnings: string[];
  sourceSchemaVersion: string;
};

const isRecord = (value: unknown): value is RecordValue => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const stringValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const numberValue = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const idValue = (value: unknown) => stringValue(value) || crypto.randomUUID();

function legacyTheme(value: unknown): BookTheme {
  if (!isRecord(value)) return structuredClone(defaultTheme);
  const result = structuredClone(defaultTheme);
  if (typeof value.pageBackground === "string") result.pageBackground = value.pageBackground;
  if (typeof value.contentBackground === "string") result.contentBackground = value.contentBackground;
  for (const key of ["h1", "h2", "h3", "body"] as const) {
    const style = value[key];
    if (!isRecord(style)) continue;
    if (typeof style.fontFamily === "string") result[key].fontFamily = style.fontFamily;
    if (typeof style.fontSize === "number") result[key].fontSize = style.fontSize;
    if (typeof style.fontWeight === "number") result[key].fontWeight = style.fontWeight;
    if (typeof style.lineHeight === "number") result[key].lineHeight = style.lineHeight;
    if (typeof style.color === "string") result[key].color = style.color;
  }
  return result;
}

function blockHtml(value: unknown, warnings: string[]): string {
  if (!isRecord(value)) return "";
  const type = stringValue(value.type, "unknown");
  const content = isRecord(value.content) ? value.content : {};
  const html = stringValue(content.html);
  if (type === "text" || type === "moodleWidget") return html;
  if (type === "widget") {
    const fallback = stringValue(content.fallbackHtml);
    if (fallback) return fallback;
    const key = stringValue(content.widgetKey, "Unknown widget");
    warnings.push(`Widget “${key}” had no fallback HTML and needs rebuilding.`);
    return `<aside class="workpath-migration-warning"><strong>${escapeHtml(key)}</strong><p>This widget needs rebuilding in WorkPath Author Local.</p></aside>`;
  }
  if (type === "note") return `<aside class="workpath-note workpath-note--${escapeHtml(stringValue(content.tone, "info"))}"><h2>${escapeHtml(stringValue(content.title, "Note"))}</h2>${html}</aside>`;
  if (type === "accordion") {
    const sections = Array.isArray(content.sections) ? content.sections : [];
    return sections.map((section) => isRecord(section) ? `<details><summary>${escapeHtml(stringValue(section.title, "Section"))}</summary>${stringValue(section.html)}</details>` : "").join("\n");
  }
  if (type === "checklist") {
    const items = Array.isArray(content.items) ? content.items : [];
    return `<section class="workpath-checklist"><h2>${escapeHtml(stringValue(content.title, "Checklist"))}</h2><ul>${items.map((item) => `<li>${escapeHtml(isRecord(item) ? stringValue(item.text) : stringValue(item))}</li>`).join("")}</ul></section>`;
  }
  if (type === "image") return `<figure data-legacy-asset-id="${escapeHtml(stringValue(content.assetId))}"><div class="workpath-missing-media">Image requires media migration: ${escapeHtml(stringValue(content.altText, "Image"))}</div>${content.caption ? `<figcaption>${escapeHtml(stringValue(content.caption))}</figcaption>` : ""}</figure>`;
  if (type === "imageText") return `<section class="workpath-image-text"><div class="workpath-missing-media" data-legacy-asset-id="${escapeHtml(stringValue(content.assetId))}">Image requires media migration: ${escapeHtml(stringValue(content.altText, "Image"))}</div><div><h2>${escapeHtml(stringValue(content.heading))}</h2>${html}</div></section>`;
  if (type === "embed") {
    const url = stringValue(content.url);
    return `<section class="workpath-embed"><h2>${escapeHtml(stringValue(content.title, "External content"))}</h2><p>${escapeHtml(stringValue(content.description))}</p>${url ? `<p><a href="${escapeHtml(url)}">Open external content</a></p>` : ""}</section>`;
  }
  if (type === "placeholder") return `<section class="workpath-placeholder"><h2>${escapeHtml(stringValue(content.title, "Placeholder"))}</h2>${html}${content.note ? `<p><em>${escapeHtml(stringValue(content.note))}</em></p>` : ""}</section>`;
  if (type === "knowledgeLink") return `<p class="workpath-knowledge-link">${escapeHtml(stringValue(content.label, "Related knowledge"))}</p>`;
  warnings.push(`Unsupported block type “${type}” was replaced with a migration notice.`);
  return `<aside class="workpath-migration-warning">Unsupported legacy block: ${escapeHtml(type)}</aside>`;
}

function convertLegacyBlock(value: unknown, warnings: string[]): ContentBlock {
  if (!isRecord(value)) return { id: crypto.randomUUID(), type: "richText", html: "<p></p>" };
  const id = idValue(value.id);
  const type = stringValue(value.type);
  const content = isRecord(value.content) ? value.content : {};
  if (type === "text") return { id, type: "richText", html: stringValue(content.html, "<p></p>") };
  if (type === "widget") {
    const widgetKey = stringValue(content.widgetKey);
    const definition = findWidgetDefinition(widgetKey);
    if (definition) return { id, type: "widget", widgetKey, definitionVersion: stringValue(content.definitionVersion, definition.version), params: isRecord(content.params) ? content.params : {}, fallbackHtml: stringValue(content.fallbackHtml) || undefined };
  }
  if (type === "note") {
    const definition = findWidgetDefinition("note")!;
    return { id, type: "widget", widgetKey: definition.key, definitionVersion: definition.version, params: { tone: stringValue(content.tone, "info"), title: stringValue(content.title, "Note"), html: stringValue(content.html) } };
  }
  if (type === "accordion") {
    const definition = findWidgetDefinition("accordion")!;
    const sections = Array.isArray(content.sections) ? content.sections.filter(isRecord).map((section) => ({ title: stringValue(section.title, "Section"), body: stringValue(section.html) })) : [];
    return { id, type: "widget", widgetKey: definition.key, definitionVersion: definition.version, params: { sections } };
  }
  if (type === "checklist") {
    const definition = findWidgetDefinition("checklist")!;
    const items = Array.isArray(content.items) ? content.items.filter(isRecord).map((item) => ({ text: stringValue(item.text) })) : [];
    return { id, type: "widget", widgetKey: definition.key, definitionVersion: definition.version, params: { title: stringValue(content.title, "Checklist"), items } };
  }
  return { id, type: "richText", html: blockHtml(value, warnings) || "<p></p>" };
}

export function importLegacyProject(value: unknown): LegacyImportResult {
  if (!isRecord(value) || !isRecord(value.project) || !Array.isArray(value.learningObjects)) throw new Error("This is not a supported WorkPath project JSON file.");
  const schemaVersion = stringValue(value.schemaVersion);
  if (schemaVersion !== "0.1" && schemaVersion !== "0.2") throw new Error(`Unsupported legacy schema version: ${schemaVersion || "missing"}.`);
  const metadata = value.project;
  const settings = isRecord(value.bookSettings) ? value.bookSettings : {};
  const sourceTopics = Array.isArray(settings.contentTopics) ? settings.contentTopics : [];
  const warnings: string[] = [];
  const project = createProject(stringValue(metadata.title, "Imported WorkPath project"));
  project.unitCode = stringValue(metadata.unitCode);
  project.createdAt = stringValue(metadata.createdAt, project.createdAt);
  project.theme = legacyTheme(settings.theme);
  project.chapters = sourceTopics.filter(isRecord).map((topic, index): Chapter => ({
    id: idValue(topic.id), title: stringValue(topic.title, `Chapter ${index + 1}`), summary: "", order: numberValue(topic.order, index + 1), enabled: topic.enabled !== false, blocks: [], subchapters: []
  }));
  if (!project.chapters.length) {
    project.chapters = [{ id: crypto.randomUUID(), title: "Imported content", summary: "", order: 1, enabled: true, blocks: [], subchapters: [] }];
    warnings.push("The source had no chapter settings; an Imported content chapter was created.");
  }
  const roleChapter = (kind: string) => project.chapters.find((chapter) => chapter.title.toLowerCase().includes(kind)) ?? project.chapters[0]!;
  value.learningObjects.filter(isRecord).forEach((item, index) => {
    const requestedId = stringValue(item.contentTopicId);
    const chapter = project.chapters.find((entry) => entry.id === requestedId) ?? roleChapter(stringValue(item.kind));
    const blocks = Array.isArray(item.blocks) ? item.blocks : [];
    const converted = blocks.map((block) => convertLegacyBlock(block, warnings));
    const subchapter: Subchapter = { id: idValue(item.id), title: stringValue(item.title, `Subchapter ${index + 1}`), summary: stringValue(item.summary), order: numberValue(item.order, chapter.subchapters.length + 1), blocks: converted.length ? converted : [{ id: crypto.randomUUID(), type: "richText", html: "<p></p>" }] };
    chapter.subchapters.push(subchapter);
  });
  const assets = Array.isArray(value.assets) ? value.assets.length : 0;
  if (assets) warnings.push(`${assets} media asset(s) were referenced but need a .workpath.zip import to migrate their files.`);
  project.assets = [];
  return { project, warnings: [...new Set(warnings)], sourceSchemaVersion: schemaVersion };
}
