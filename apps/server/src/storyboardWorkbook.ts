import ExcelJS from "exceljs";
import JSZip from "jszip";
import { STORYBOARD_BLOCK_TYPES, WIDGET_DEFINITIONS, storyboardRowFromBlock, verifyStoryboardRows, type BlockTemplate, type Chapter, type StoryboardRowInput, type StoryboardVerification, type Subchapter, type WorkPathProject } from "@workpath/core";

export type BookStoryboardPage = { worksheet: string; kind: "chapter" | "subchapter"; parentWorksheet?: string; order: number; enabled: boolean; title: string; summary: string; blocks: Chapter["blocks"] };
export type BookStoryboardVerification = { title: string; unitCode: string; pages: BookStoryboardPage[]; templates: BlockTemplate[]; errors: string[]; valid: boolean };

const headers = ["Topic", "Block order", "Block type", "Content", "Mapping", "Settings JSON", "Validation notes"];
const guidance: Record<string, string> = {
  "Rich text": "Markdown headings, paragraphs, bold text and lists.",
  "Note / callout": "First bold line is the title; remaining Markdown is the body.",
  Accordion: "Use bold section headings followed by each section body.",
  Checklist: "Optional title followed by a Markdown bullet list.",
  Quote: "Quote text followed by an attribution beginning with —.",
  Image: "Use bold labels: Suggested image, Alternative text, and Caption.",
  "Image + text": "Bold heading and body, followed by Suggested image and Alternative text labels.",
  Table: "Optional caption followed by a Markdown table.",
  "Card grid": "Configure cards in Settings JSON for a lossless round trip.",
  "Responsive columns": "Configure column headings and rich text in Settings JSON.",
  "Resource link card": "Configure the resource title, URL, description and label in Settings JSON.",
  "Styled list group": "Configure list items and optional links in Settings JSON.",
  "Code snippet": "Configure caption, language and code in Settings JSON.",
  "True or false": "Configure the statement, answer and feedback in Settings JSON.",
  "Single-answer knowledge check": "Configure question, options, answer and feedback in Settings JSON.",
  "Multiple-answer knowledge check": "Configure question, options, answers and feedback in Settings JSON.",
  "Flip cards": "Configure prompt-and-reveal cards in Settings JSON.",
  "Hotspot image": "Configure image metadata, positions and callouts in Settings JSON.",
  "Custom HTML": "Enter Moodle-safe HTML in Settings JSON; executable markup is rejected.",
  "Image gallery / carousel": "Configure images, alternative text and captions in Settings JSON.",
  "Video embed": "Configure an approved video URL, title, description and transcript in Settings JSON.",
};
const blockCategories = new Map<string, string>([["Rich text", "Text"], ...WIDGET_DEFINITIONS.map((definition): [string, string] => [definition.name, definition.category])]);

const cellText = (cell: ExcelJS.Cell) => typeof cell.value === "string" || typeof cell.value === "number" ? String(cell.value) : cell.text;

export async function parseStoryboardFile(bytes: Uint8Array, filename: string): Promise<StoryboardVerification> {
  const rows = filename.toLowerCase().endsWith(".csv") ? parseCsv(new TextDecoder().decode(bytes)) : await parseWorkbook(bytes);
  return verifyStoryboardRows(rows);
}

async function parseWorkbook(bytes: Uint8Array) {
  const workbook = await loadWorkbook(bytes);
  const sheet = workbook.getWorksheet("Storyboard") ?? workbook.worksheets[0]; if (!sheet) throw new Error("Workbook has no Storyboard sheet.");
  return storyboardRows(sheet);
}

function storyboardRows(sheet: ExcelJS.Worksheet) {
  const headerMap = new Map<string, number>(); sheet.getRow(1).eachCell((cell, column) => headerMap.set(cellText(cell).trim().toLowerCase(), column));
  for (const header of headers.slice(0, 6)) if (!headerMap.has(header.toLowerCase())) throw new Error(`Missing required column: ${header}.`);
  const rows: StoryboardRowInput[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (header: string) => cellText(row.getCell(headerMap.get(header.toLowerCase())!));
    const input = { topic: get("Topic"), order: get("Block order"), blockType: get("Block type"), content: get("Content"), mapping: get("Mapping"), settingsJson: get("Settings JSON") };
    if (Object.values(input).some((value) => String(value).trim())) rows.push(input);
  }); return rows;
}

export async function parseBookStoryboard(bytes: Uint8Array): Promise<BookStoryboardVerification> {
  const workbook = await loadWorkbook(bytes);
  const structure = workbook.getWorksheet("Book Structure");
  const templateSheet = workbook.getWorksheet("Block Templates");
  const reserved = new Set(["book structure", "block templates", "instructions", "block types"]);
  const errors: string[] = []; const pages: BookStoryboardPage[] = []; const templates: BlockTemplate[] = [];
  let title = "Imported Excel Book"; let unitCode = "";
  const metadata = new Map<string, { kind: "chapter" | "subchapter"; parentWorksheet?: string; order: number; enabled: boolean; title: string; summary: string }>();
  if (structure) {
    const columns = new Map<string, number>(); structure.getRow(1).eachCell((cell, column) => columns.set(cellText(cell).trim().toLowerCase(), column));
    for (const required of ["Project title", "Worksheet", "Page type", "Order", "Enabled", "Title", "Summary"]) if (!columns.has(required.toLowerCase())) errors.push(`Book Structure is missing required column: ${required}.`);
    structure.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || errors.length) return;
      const get = (name: string) => cellText(row.getCell(columns.get(name.toLowerCase()) ?? 0)).trim();
      const worksheet = get("Worksheet"); if (!worksheet) return;
      if (rowNumber === 2) { title = get("Project title") || title; unitCode = get("Unit code"); }
      const kind = get("Page type").toLowerCase(); const order = Number(get("Order"));
      if (kind !== "chapter" && kind !== "subchapter") { errors.push(`Book Structure row ${rowNumber} has an invalid Page type.`); return; }
      if (!Number.isInteger(order) || order < 1) { errors.push(`Book Structure row ${rowNumber} has an invalid Order.`); return; }
      metadata.set(worksheet, { kind, parentWorksheet: get("Parent worksheet") || undefined, order, enabled: get("Enabled").toLowerCase() !== "false", title: get("Title") || worksheet, summary: get("Summary") });
    });
  }
  const contentSheets = workbook.worksheets.filter((sheet) => !reserved.has(sheet.name.toLowerCase()));
  if (!contentSheets.length) errors.push("Workbook contains no chapter worksheets.");
  contentSheets.forEach((sheet, index) => {
    try {
      const verification = verifyStoryboardRows(storyboardRows(sheet));
      verification.messages.filter((message) => message.severity === "error").forEach((message) => errors.push(`${sheet.name}, row ${message.row}: ${message.message}`));
      const details = metadata.get(sheet.name) ?? { kind: "chapter" as const, order: index + 1, enabled: true, title: verification.title || sheet.name, summary: "" };
      pages.push({ worksheet: sheet.name, ...details, title: verification.title || details.title, blocks: verification.rows.flatMap((row) => row.block ? [row.block] : []) });
    } catch (error) { errors.push(`${sheet.name}: ${error instanceof Error ? error.message : "Could not read worksheet."}`); }
  });
  if (structure) for (const worksheet of metadata.keys()) if (!workbook.getWorksheet(worksheet)) errors.push(`Book Structure references missing worksheet: ${worksheet}.`);
  for (const page of pages.filter((entry) => entry.kind === "subchapter")) if (!page.parentWorksheet || !pages.some((entry) => entry.kind === "chapter" && entry.worksheet === page.parentWorksheet)) errors.push(`${page.worksheet} does not reference a valid parent chapter worksheet.`);
  if (templateSheet) parseBlockTemplates(templateSheet, templates, errors);
  return { title, unitCode, pages, templates, errors, valid: errors.length === 0 };
}

function parseBlockTemplates(sheet: ExcelJS.Worksheet, templates: BlockTemplate[], errors: string[]) {
  const expected = ["Template name", "Block type", "Content", "Mapping", "Settings JSON"];
  const columns = new Map<string, number>(); sheet.getRow(1).eachCell((cell, column) => columns.set(cellText(cell).trim().toLowerCase(), column));
  for (const header of expected) if (!columns.has(header.toLowerCase())) errors.push(`Block Templates is missing required column: ${header}.`);
  if (errors.some((error) => error.startsWith("Block Templates is missing"))) return;
  const seen = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (header: string) => cellText(row.getCell(columns.get(header.toLowerCase())!)).trim();
    const name = get("Template name"); if (!name && !expected.slice(1).some((header) => get(header))) return;
    if (!name) { errors.push(`Block Templates row ${rowNumber}: Template name is required.`); return; }
    if (seen.has(name.toLocaleLowerCase())) { errors.push(`Block Templates row ${rowNumber}: Template name “${name}” is duplicated.`); return; }
    seen.add(name.toLocaleLowerCase());
    const verification = verifyStoryboardRows([{ topic: name, order: 1, blockType: get("Block type"), content: get("Content"), mapping: get("Mapping"), settingsJson: get("Settings JSON") }]);
    const portableImageIssues = new Set(["Choose an image.", "Choose a hotspot image.", "Choose an image for every gallery item.", "Choose an image for every flip card."]);
    const blockingMessages = verification.messages.filter((message) => message.severity === "error" && !portableImageIssues.has(message.message));
    blockingMessages.forEach((message) => errors.push(`Block Templates row ${rowNumber}: ${message.message}`));
    const block = verification.rows[0]?.block; if (!block || blockingMessages.length) return;
    const now = new Date().toISOString(); templates.push({ id: crypto.randomUUID(), name, block, createdAt: now, updatedAt: now });
  });
}

async function loadWorkbook(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer); return workbook; }
  catch (standardError) {
    try {
      const compatibleBytes = await normalizeNamespacedWorkbook(bytes);
      const compatibleWorkbook = new ExcelJS.Workbook(); await compatibleWorkbook.xlsx.load(compatibleBytes as unknown as ExcelJS.Buffer); return compatibleWorkbook;
    } catch {
      throw new Error(`Could not read this Excel workbook. Open it in Excel and save it as a standard .xlsx file, then try again. (${standardError instanceof Error ? standardError.message : "Unsupported workbook package"})`);
    }
  }
}

async function normalizeNamespacedWorkbook(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  if (!zip.file("[Content_Types].xml") || !zip.file("xl/workbook.xml")) throw new Error("Workbook package is incomplete.");
  for (const [name, entry] of Object.entries({ ...zip.files })) {
    if (entry.dir) continue;
    if (name.startsWith("xl/tables/")) { zip.remove(name); continue; }
    if (name.endsWith(".xml")) {
      let xml = await entry.async("text");
      xml = xml.replace(/^\uFEFF/, "").replace(/<x:tableParts\b[\s\S]*?<\/x:tableParts>/g, "").replace(/<\/x:/g, "</").replace(/<x:/g, "<").replace(/xmlns:x=/g, "xmlns=");
      if (name === "[Content_Types].xml") {
        xml = xml
          .replace(/<Default Extension="xml" ContentType="application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml"\s*\/>/, '<Default Extension="xml" ContentType="application/xml" /><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />')
          .replace(/<Override PartName="\/xl\/tables\/[^>]+\/>/g, "");
      }
      zip.file(name, xml);
      continue;
    }
    if (name.endsWith(".rels")) {
      let relationships = (await entry.async("text")).replace(/^\uFEFF/, "").replace(/<Relationship\b(?=[^>]*\/relationships\/table)[^>]*\/>/g, "");
      relationships = name === "xl/_rels/workbook.xml.rels" ? relationships.replace(/Target="\/xl\//g, 'Target="') : relationships.replace(/Target="\//g, 'Target="');
      zip.file(name, relationships);
    }
  }
  return zip.generateAsync({ type: "uint8array" });
}

export async function createStoryboardTemplate() { return createWorkbook([], ""); }

export async function exportStoryboard(page: Chapter | Subchapter) {
  return createWorkbook(page.blocks.map((block, index) => storyboardRowFromBlock(page.title, block, index + 1)), page.title);
}

export async function exportBookStoryboard(project: WorkPathProject) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "WorkPath Author Local"; workbook.created = new Date();
  const usedNames = new Set<string>(["book structure", "block templates", "instructions", "block types"]);
  const structureRows: Array<[string, string, string, string, string, number, boolean, string, string]> = [];
  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
  for (const chapter of chapters) {
    const chapterSheet = worksheetName(chapter.title, usedNames);
    addStoryboardSheet(workbook, chapterSheet, chapter.blocks.map((block, index) => storyboardRowFromBlock(chapter.title, block, index + 1)), chapter.title);
    structureRows.push([project.title, project.unitCode, chapterSheet, "chapter", "", chapter.order, chapter.enabled, chapter.title, chapter.summary]);
    for (const subchapter of [...chapter.subchapters].sort((a, b) => a.order - b.order)) {
      const subchapterSheet = worksheetName(subchapter.title, usedNames);
      addStoryboardSheet(workbook, subchapterSheet, subchapter.blocks.map((block, index) => storyboardRowFromBlock(subchapter.title, block, index + 1)), subchapter.title);
      structureRows.push([project.title, project.unitCode, subchapterSheet, "subchapter", chapterSheet, subchapter.order, true, subchapter.title, subchapter.summary]);
    }
  }
  if (!workbook.worksheets.length) addStoryboardSheet(workbook, "Storyboard", [], "");
  addBookStructureSheet(workbook, structureRows);
  addBlockTemplatesSheet(workbook, project.blockTemplates);
  addReferenceSheets(workbook, "Each titled Storyboard sheet represents one chapter or subchapter in this book.");
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function addBlockTemplatesSheet(workbook: ExcelJS.Workbook, templates: BlockTemplate[]) {
  const sheet = workbook.addWorksheet("Block Templates", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ width: 34 }, { width: 24 }, { width: 80 }, { width: 28 }, { width: 55 }];
  const header = sheet.addRow(["Template name", "Block type", "Content", "Mapping", "Settings JSON"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } };
  templates.forEach((template) => { const row = storyboardRowFromBlock(template.name, template.block, 1); sheet.addRow([template.name, row.blockType, row.content, row.mapping, row.settingsJson]); });
  sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; }); sheet.autoFilter = { from: "A1", to: "E1" };
}

function addBookStructureSheet(workbook: ExcelJS.Workbook, rows: Array<[string, string, string, string, string, number, boolean, string, string]>) {
  const sheet = workbook.addWorksheet("Book Structure", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ width: 34 }, { width: 18 }, { width: 31 }, { width: 15 }, { width: 31 }, { width: 10 }, { width: 12 }, { width: 38 }, { width: 70 }];
  const header = sheet.addRow(["Project title", "Unit code", "Worksheet", "Page type", "Parent worksheet", "Order", "Enabled", "Title", "Summary"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } };
  rows.forEach((row) => sheet.addRow(row)); sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; }); sheet.autoFilter = { from: "A1", to: "I1" };
}

async function createWorkbook(rows: StoryboardRowInput[], title: string) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "WorkPath Author Local"; workbook.created = new Date();
  addStoryboardSheet(workbook, "Storyboard", rows, title);
  addReferenceSheets(workbook, "One workbook creates one chapter or one subchapter.");
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function addStoryboardSheet(workbook: ExcelJS.Workbook, name: string, rows: StoryboardRowInput[], title: string) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ width: 30 }, { width: 13 }, { width: 20 }, { width: 80 }, { width: 28 }, { width: 55 }, { width: 48 }];
  const header = sheet.addRow(headers); header.font = { bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } }; header.alignment = { vertical: "middle" }; header.height = 26;
  const sourceRows = rows.length ? rows : [{ topic: title, order: 1, blockType: "Rich text", content: "", mapping: "", settingsJson: "" }];
  sourceRows.forEach((row) => sheet.addRow([row.topic, row.order, row.blockType, row.content, row.mapping, row.settingsJson]));
  for (let row = 2; row <= Math.max(101, sourceRows.length + 20); row += 1) {
    const lastTypeRow = STORYBOARD_BLOCK_TYPES.length + 1;
    sheet.getCell(row, 3).dataValidation = { type: "list", allowBlank: false, formulae: [`'Block Types'!$A$2:$A$${lastTypeRow}`], errorTitle: "Invalid block type", error: "Choose a block type from the dropdown.", showErrorMessage: true };
    sheet.getCell(row, 7).value = { formula: `IF(C${row}="","",IFERROR(VLOOKUP(C${row},'Block Types'!$A$2:$C$${lastTypeRow},3,FALSE),"Invalid block type"))` };
    sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
  }
  sheet.autoFilter = { from: "A1", to: "G1" };
}

function addReferenceSheets(workbook: ExcelJS.Workbook, description: string) {
  const instructions = workbook.addWorksheet("Instructions"); instructions.columns = [{ width: 28 }, { width: 105 }]; instructions.addRow(["WorkPath storyboard", description]); instructions.addRow(["Topic", "Enter the chapter or subchapter title in the first content row. Blank Topic cells underneath inherit that title."]); instructions.addRow(["Block order", "Use unique positive whole numbers. WorkPath sorts rows by this value."]); instructions.addRow(["Block type", "Choose one of the 21 exact names from the dropdown. See Block Types for categories and authoring guidance."]); instructions.addRow(["Content", "The original eight storyboard types support documented Markdown. New structured blocks are preserved through Settings JSON."]); instructions.addRow(["Mapping", "Optional author-only curriculum or requirement mapping. It never appears in preview or Moodle export."]); instructions.addRow(["Settings JSON", "Authoritative structured block data used for lossless export and re-import. Do not rename its properties manually unless you understand the block schema."]); instructions.addRow(["Images", "Image IDs are removed during export. Without an image, WorkPath visibly displays the authored alternative text; if that is also blank, whole-book import assigns a shared Placeholder image. Replace fallbacks during review."]); instructions.addRow(["Custom HTML", "Scripts, iframes, event handlers and JavaScript URLs are rejected. Use Video embed for approved video providers."]); instructions.addRow(["Whole books", "Export Excel Book adds one content sheet per page plus Book Structure, which preserves hierarchy, summaries, ordering and enabled state."]); instructions.addRow(["Block templates", "Whole-book exports include project-scoped reusable blocks on Block Templates. Importing that workbook recreates the template library."]); instructions.getRow(1).font = { bold: true, size: 15 }; instructions.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  const types = workbook.addWorksheet("Block Types"); types.columns = [{ width: 34 }, { width: 22 }, { width: 100 }]; types.addRow(["Block type", "Category", "Required Content format or guidance"]); STORYBOARD_BLOCK_TYPES.forEach((type) => types.addRow([type, blockCategories.get(type) ?? "Other", guidance[type]])); types.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; types.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } }; types.autoFilter = { from: "A1", to: "C1" }; types.views = [{ state: "frozen", ySplit: 1 }]; types.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
}

function worksheetName(title: string, used: Set<string>) {
  const base = title.trim().replace(/[\\/?*\[\]:]/g, " ").replace(/\s+/g, " ").slice(0, 31).trim() || "Untitled chapter";
  let name = base; let suffix = 2;
  while (used.has(name.toLowerCase())) { const marker = ` (${suffix})`; name = `${base.slice(0, 31 - marker.length).trim()}${marker}`; suffix += 1; }
  used.add(name.toLowerCase()); return name;
}

export function exportStoryboardCsv(page: Chapter | Subchapter) {
  const rows = page.blocks.map((block, index) => storyboardRowFromBlock(page.title, block, index + 1)); return [headers.slice(0, 6), ...rows.map((row) => [row.topic, row.order, row.blockType, row.content, row.mapping, row.settingsJson])].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function parseCsv(source: string) {
  const records: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < source.length; index += 1) { const char = source[index]!; const next = source[index + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(cell); if (row.some((value) => value.length)) records.push(row); row = []; cell = ""; } else cell += char; }
  row.push(cell); if (row.some((value) => value.length)) records.push(row); if (!records.length) return [];
  const map = new Map(records[0]!.map((header, index) => [header.trim().toLowerCase(), index])); for (const header of headers.slice(0, 6)) if (!map.has(header.toLowerCase())) throw new Error(`Missing required column: ${header}.`);
  return records.slice(1).filter((record) => record.some((value) => value.trim())).map((record): StoryboardRowInput => ({ topic: record[map.get("topic")!] ?? "", order: record[map.get("block order")!] ?? "", blockType: record[map.get("block type")!] ?? "", content: record[map.get("content")!] ?? "", mapping: record[map.get("mapping")!] ?? "", settingsJson: record[map.get("settings json")!] ?? "" }));
}
