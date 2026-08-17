import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { createProject, createWidgetBlock } from "@workpath/core";
import { createStoryboardTemplate, exportBookStoryboard, exportStoryboard, exportStoryboardCsv, parseBookStoryboard, parseStoryboardFile } from "./storyboardWorkbook.js";

test("generates and parses the validated Excel template", async () => {
  const bytes = await createStoryboardTemplate();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const result = await parseStoryboardFile(bytes, "template.xlsx");
  assert.equal(result.title, "");
  assert.equal(result.valid, false);
  assert.equal(result.rows[0]?.blockType, "Rich text");
  const types = workbook.getWorksheet("Block Types")!;
  assert.equal(types.rowCount, 22); assert.deepEqual(Array.from({ length: 3 }, (_, index) => types.getRow(1).getCell(index + 1).text), ["Block type", "Category", "Required Content format or guidance"]);
  assert.equal(types.getRow(22).getCell(1).text, "Video embed"); assert.equal(types.getRow(22).getCell(2).text, "Media");
  const storyboard = workbook.getWorksheet("Storyboard")!;
  assert.deepEqual(storyboard.getCell("C2").dataValidation.formulae, ["'Block Types'!$A$2:$A$22"]);
  assert.match(String((storyboard.getCell("G2").value as { formula?: string }).formula), /\$C\$22,3,FALSE/);
  assert.match(workbook.getWorksheet("Instructions")!.getCell("B8").text, /shared Placeholder image/);
});

test("round-trips a chapter through XLSX and multiline CSV", async () => {
  const chapter = createProject("Test").chapters[0]!; chapter.title = "CSV chapter"; chapter.blocks[0] = { id: crypto.randomUUID(), type: "richText", html: "<h2>Heading</h2><p>First line</p><p>Second, quoted line</p>", metadata: { mapping: "PC1.1" } };
  const workbookResult = await parseStoryboardFile(await exportStoryboard(chapter), "chapter.xlsx");
  assert.equal(workbookResult.valid, true); assert.equal(workbookResult.rows[0]?.block?.metadata?.mapping, "PC1.1");
  const csvResult = await parseStoryboardFile(new TextEncoder().encode(exportStoryboardCsv(chapter)), "chapter.csv");
  assert.equal(csvResult.valid, true); assert.match(csvResult.rows[0]?.content ?? "", /Second, quoted line/);
});

test("exports a full book with one structured sheet per chapter and subchapter", async () => {
  const project = createProject("Workbook");
  project.blockTemplates.push({ id: crypto.randomUUID(), name: "Reusable introduction", block: { id: crypto.randomUUID(), type: "richText", html: "<p>Template content</p>" }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
  const imageTemplate = createWidgetBlock("image"); imageTemplate.params.imageAssetId = "project-local-image"; imageTemplate.params.altText = "A reusable example image";
  project.blockTemplates.push({ id: crypto.randomUUID(), name: "Reusable image", block: imageTemplate, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
  project.chapters[0]!.title = "Repeated title";
  project.chapters[0]!.subchapters.push({ id: crypto.randomUUID(), title: "Repeated title", summary: "", order: 1, blocks: [{ id: crypto.randomUUID(), type: "richText", html: "<p>Subchapter</p>" }] });
  project.chapters.push({ id: crypto.randomUUID(), title: "A title longer than thirty-one characters for Excel", summary: "", order: 2, enabled: false, blocks: [{ id: crypto.randomUUID(), type: "richText", html: "<p>Disabled source</p>" }], subchapters: [] });
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await exportBookStoryboard(project) as unknown as ExcelJS.Buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Repeated title", "Repeated title (2)", "A title longer than thirty-one", "Book Structure", "Block Templates", "Instructions", "Block Types"]);
  for (const sheet of workbook.worksheets.slice(0, 3)) assert.deepEqual(Array.from({ length: 7 }, (_, index) => sheet.getRow(1).getCell(index + 1).text), ["Topic", "Block order", "Block type", "Content", "Mapping", "Settings JSON", "Validation notes"]);
  const verification = await parseBookStoryboard(await exportBookStoryboard(project));
  assert.equal(verification.valid, true); assert.equal(verification.title, "Workbook"); assert.equal(verification.pages.length, 3);
  assert.equal(verification.pages[1]?.kind, "subchapter"); assert.equal(verification.pages[1]?.parentWorksheet, "Repeated title");
  assert.equal(verification.pages[2]?.enabled, false);
  assert.equal(verification.templates.length, 2); assert.equal(verification.templates[0]?.name, "Reusable introduction");
  assert.equal(verification.templates[0]?.block.type, "richText");
  const importedImage = verification.templates[1]?.block; assert.equal(importedImage?.type, "widget");
  if (importedImage?.type === "widget") assert.equal(importedImage.params.imageAssetId, "");
});

test("normalises namespaced workflow workbooks before validation", async () => {
  const project = createProject("Workflow workbook");
  const zip = await JSZip.loadAsync(await exportBookStoryboard(project));
  const contentTypes = await zip.file("[Content_Types].xml")!.async("text");
  zip.file("[Content_Types].xml", contentTypes
    .replace('<Default Extension="xml" ContentType="application/xml"/>', '<Default Extension="xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />')
    .replace(/<Override PartName="\/xl\/workbook\.xml"[^>]+\/>/, ""));
  const rootRelationships = await zip.file("_rels/.rels")!.async("text");
  zip.file("_rels/.rels", rootRelationships.replace('Target="xl/workbook.xml"', 'Target="/xl/workbook.xml"'));
  const result = await parseBookStoryboard(await zip.generateAsync({ type: "uint8array" }));
  assert.equal(result.valid, true); assert.equal(result.title, "Workflow workbook"); assert.equal(result.pages.length, 1);
});
