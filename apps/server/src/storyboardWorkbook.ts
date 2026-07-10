import ExcelJS from "exceljs";
import { STORYBOARD_BLOCK_TYPES, storyboardRowFromBlock, verifyStoryboardRows, type Chapter, type StoryboardRowInput, type StoryboardVerification, type Subchapter } from "@workpath/core";

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
};

const cellText = (cell: ExcelJS.Cell) => typeof cell.value === "string" || typeof cell.value === "number" ? String(cell.value) : cell.text;

export async function parseStoryboardFile(bytes: Uint8Array, filename: string): Promise<StoryboardVerification> {
  const rows = filename.toLowerCase().endsWith(".csv") ? parseCsv(new TextDecoder().decode(bytes)) : await parseWorkbook(bytes);
  return verifyStoryboardRows(rows);
}

async function parseWorkbook(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet("Storyboard") ?? workbook.worksheets[0]; if (!sheet) throw new Error("Workbook has no Storyboard sheet.");
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

export async function createStoryboardTemplate() { return createWorkbook([], ""); }

export async function exportStoryboard(page: Chapter | Subchapter) {
  return createWorkbook(page.blocks.map((block, index) => storyboardRowFromBlock(page.title, block, index + 1)), page.title);
}

async function createWorkbook(rows: StoryboardRowInput[], title: string) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "WorkPath Author Local"; workbook.created = new Date();
  const sheet = workbook.addWorksheet("Storyboard", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ width: 30 }, { width: 13 }, { width: 20 }, { width: 80 }, { width: 28 }, { width: 55 }, { width: 48 }];
  const header = sheet.addRow(headers); header.font = { bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } }; header.alignment = { vertical: "middle" }; header.height = 26;
  const sourceRows = rows.length ? rows : [{ topic: title, order: 1, blockType: "Rich text", content: "", mapping: "", settingsJson: "" }];
  sourceRows.forEach((row) => sheet.addRow([row.topic, row.order, row.blockType, row.content, row.mapping, row.settingsJson]));
  for (let row = 2; row <= Math.max(101, sourceRows.length + 20); row += 1) {
    sheet.getCell(row, 3).dataValidation = { type: "list", allowBlank: false, formulae: ["'Block Types'!$A$2:$A$9"], errorTitle: "Invalid block type", error: "Choose a block type from the dropdown.", showErrorMessage: true };
    sheet.getCell(row, 7).value = { formula: `IF(C${row}="","",IFERROR(VLOOKUP(C${row},'Block Types'!$A$2:$B$9,2,FALSE),"Invalid block type"))` };
    sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
  }
  sheet.autoFilter = { from: "A1", to: "G1" };
  const instructions = workbook.addWorksheet("Instructions"); instructions.columns = [{ width: 28 }, { width: 105 }]; instructions.addRow(["WorkPath storyboard", "One workbook creates one chapter or one subchapter."]); instructions.addRow(["Topic", "Enter the title in the first content row. Blank Topic cells underneath inherit that title."]); instructions.addRow(["Block order", "Use unique positive whole numbers."]); instructions.addRow(["Content", "Use the documented Markdown convention for the chosen block type."]); instructions.addRow(["Mapping", "Author-only mapping metadata. It never appears in preview or Moodle export."]); instructions.addRow(["Settings JSON", "Optional. WorkPath exports exact widget settings here for lossless round trips. Chat-created storyboards may leave it blank."]); instructions.getRow(1).font = { bold: true, size: 15 }; instructions.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  const types = workbook.addWorksheet("Block Types"); types.columns = [{ width: 22 }, { width: 100 }]; types.addRow(["Block type", "Required Content format"]); STORYBOARD_BLOCK_TYPES.forEach((type) => types.addRow([type, guidance[type]])); types.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; types.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } }; types.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
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
