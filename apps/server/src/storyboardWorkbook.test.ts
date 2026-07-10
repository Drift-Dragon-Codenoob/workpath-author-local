import assert from "node:assert/strict";
import test from "node:test";
import { createProject } from "@workpath/core";
import { createStoryboardTemplate, exportStoryboard, exportStoryboardCsv, parseStoryboardFile } from "./storyboardWorkbook.js";

test("generates and parses the validated Excel template", async () => {
  const bytes = await createStoryboardTemplate();
  const result = await parseStoryboardFile(bytes, "template.xlsx");
  assert.equal(result.title, "");
  assert.equal(result.valid, false);
  assert.equal(result.rows[0]?.blockType, "Rich text");
});

test("round-trips a chapter through XLSX and multiline CSV", async () => {
  const chapter = createProject("Test").chapters[0]!; chapter.title = "CSV chapter"; chapter.blocks[0] = { id: crypto.randomUUID(), type: "richText", html: "<h2>Heading</h2><p>First line</p><p>Second, quoted line</p>", metadata: { mapping: "PC1.1" } };
  const workbookResult = await parseStoryboardFile(await exportStoryboard(chapter), "chapter.xlsx");
  assert.equal(workbookResult.valid, true); assert.equal(workbookResult.rows[0]?.block?.metadata?.mapping, "PC1.1");
  const csvResult = await parseStoryboardFile(new TextEncoder().encode(exportStoryboardCsv(chapter)), "chapter.csv");
  assert.equal(csvResult.valid, true); assert.match(csvResult.rows[0]?.content ?? "", /Second, quoted line/);
});
