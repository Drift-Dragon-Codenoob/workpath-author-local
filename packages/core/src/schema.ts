export type TextStyle = { fontFamily: string; fontSize: number; fontWeight: number; lineHeight: number; color: string };
export type BookTheme = { pageBackground: string; contentBackground: string; h1: TextStyle; h2: TextStyle; h3: TextStyle; body: TextStyle };
export type BlockMetadata = { mapping?: string; imagePrompt?: string };
export type RichTextBlock = { id: string; type: "richText"; html: string; metadata?: BlockMetadata };
export type WidgetBlock = { id: string; type: "widget"; widgetKey: string; definitionVersion: string; params: Record<string, unknown>; fallbackHtml?: string; metadata?: BlockMetadata };
export type ContentBlock = RichTextBlock | WidgetBlock;
export type Subchapter = { id: string; title: string; summary: string; order: number; blocks: ContentBlock[] };
export type Chapter = { id: string; title: string; summary: string; order: number; enabled: boolean; blocks: ContentBlock[]; subchapters: Subchapter[] };
export type AssetRecord = { id: string; filename: string; mimeType: string; size: number; relativePath: string };

export type WorkPathProject = {
  schemaVersion: "1.3";
  id: string;
  title: string;
  unitCode: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  chapters: Chapter[];
  assets: AssetRecord[];
  theme: BookTheme;
};

export type ContentTopic = { id: string; title: string; order: number; enabled: boolean };
export type Topic = { id: string; contentTopicId: string; title: string; summary: string; order: number; blocks: ContentBlock[] };
type ProjectV11 = Omit<WorkPathProject, "schemaVersion" | "chapters"> & { schemaVersion: "1.1"; contentTopics: ContentTopic[]; topics: Topic[] };
type ProjectV10 = Omit<ProjectV11, "schemaVersion" | "topics"> & { schemaVersion: "1.0"; topics: Array<Omit<Topic, "blocks"> & { blocks: Array<{ id: string; type: "html"; html: string }> }> };
type ProjectV12 = Omit<WorkPathProject, "schemaVersion"> & { schemaVersion: "1.2" };

export const defaultTheme: BookTheme = {
  pageBackground: "#f6f7fb", contentBackground: "#ffffff",
  h1: { fontFamily: "Arial, sans-serif", fontSize: 32, fontWeight: 700, lineHeight: 1.2, color: "#10213f" },
  h2: { fontFamily: "Arial, sans-serif", fontSize: 26, fontWeight: 700, lineHeight: 1.25, color: "#10213f" },
  h3: { fontFamily: "Arial, sans-serif", fontSize: 21, fontWeight: 700, lineHeight: 1.3, color: "#17213d" },
  body: { fontFamily: "Arial, sans-serif", fontSize: 16, fontWeight: 400, lineHeight: 1.55, color: "#17213d" }
};

const starterBlock = (): RichTextBlock => ({ id: crypto.randomUUID(), type: "richText", html: "<p>Start writing here.</p>" });

export function createProject(title: string): WorkPathProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.3", id: crypto.randomUUID(), title, unitCode: "", revision: 1, createdAt: now, updatedAt: now,
    chapters: [{ id: crypto.randomUUID(), title: "Chapter 1", summary: "", order: 1, enabled: true, blocks: [starterBlock()], subchapters: [] }],
    assets: [], theme: structuredClone(defaultTheme)
  };
}

function migrateCurrentBlock(block: ContentBlock): ContentBlock {
  if (block.type !== "widget" || block.widgetKey !== "table" || Array.isArray(block.params.columns)) return block;
  const headings = [block.params.heading1, block.params.heading2, block.params.heading3].map((heading, index) => ({ heading: typeof heading === "string" ? heading : `Column ${index + 1}` }));
  const oldRows = Array.isArray(block.params.rows) ? block.params.rows : [];
  const rows = oldRows.map((row) => { const entry = row && typeof row === "object" ? row as Record<string, unknown> : {}; return { cells: [entry.cell1, entry.cell2, entry.cell3].map((cell) => typeof cell === "string" ? cell : "") }; });
  return { ...block, definitionVersion: "1.1.0", params: { caption: block.params.caption ?? "Table summary", columns: headings, rows } };
}

function isCurrentShape(value: unknown): value is WorkPathProject | ProjectV12 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (candidate.schemaVersion === "1.2" || candidate.schemaVersion === "1.3") && typeof candidate.id === "string" && Array.isArray(candidate.chapters) && Array.isArray(candidate.assets);
}

function isLegacyLocal(value: unknown): value is ProjectV10 | ProjectV11 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (candidate.schemaVersion === "1.0" || candidate.schemaVersion === "1.1") && typeof candidate.id === "string" && Array.isArray(candidate.contentTopics) && Array.isArray(candidate.topics) && Array.isArray(candidate.assets);
}

export function migrateProject(value: unknown): WorkPathProject {
  if (isCurrentShape(value)) return { ...value, schemaVersion: "1.3", chapters: value.chapters.map((chapter) => ({ ...chapter, blocks: chapter.blocks.map(migrateCurrentBlock), subchapters: chapter.subchapters.map((subchapter) => ({ ...subchapter, blocks: subchapter.blocks.map(migrateCurrentBlock) })) })) };
  if (!isLegacyLocal(value)) throw new Error("Invalid or unsupported WorkPath Local project data.");
  const topics: Topic[] = value.schemaVersion === "1.0" ? value.topics.map((topic) => ({ ...topic, blocks: topic.blocks.map((block) => ({ id: block.id, type: "richText" as const, html: block.html })) })) : value.topics.map((topic) => ({ ...topic, blocks: topic.blocks.map(migrateCurrentBlock) }));
  return {
    schemaVersion: "1.3", id: value.id, title: value.title, unitCode: value.unitCode, revision: value.revision, createdAt: value.createdAt, updatedAt: value.updatedAt,
    chapters: value.contentTopics.map((contentTopic) => ({ id: contentTopic.id, title: contentTopic.title, summary: "", order: contentTopic.order, enabled: contentTopic.enabled, blocks: [], subchapters: topics.filter((topic) => topic.contentTopicId === contentTopic.id).map((topic) => ({ id: topic.id, title: topic.title, summary: topic.summary, order: topic.order, blocks: topic.blocks })) })),
    assets: value.assets, theme: value.theme
  };
}

const validBlocks = (blocks: unknown): blocks is ContentBlock[] => Array.isArray(blocks) && blocks.every((block) => block && typeof block === "object" && ((block as ContentBlock).type === "richText" || (block as ContentBlock).type === "widget"));

export function assertProject(value: unknown): asserts value is WorkPathProject {
  if (!isCurrentShape(value) || value.schemaVersion !== "1.3") throw new Error("Invalid WorkPath Local 1.3 project data.");
  for (const chapter of value.chapters) {
    if (!validBlocks(chapter.blocks) || !Array.isArray(chapter.subchapters)) throw new Error(`Invalid content in chapter “${chapter.title}”.`);
    for (const subchapter of chapter.subchapters) if (!validBlocks(subchapter.blocks)) throw new Error(`Invalid content in subchapter “${subchapter.title}”.`);
  }
}
