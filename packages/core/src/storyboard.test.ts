import assert from "node:assert/strict";
import test from "node:test";
import { createWidgetBlock, storyboardRowFromBlock, verifyStoryboardRows } from "./index.js";

test("verifies a representative storyboard and preserves author-only mapping", () => {
  const result = verifyStoryboardRows([
    { topic: "Understanding the work brief", order: 1, blockType: "Rich text", content: "## What is a work brief?\n\nA **work brief** explains the task.\n\n- scope\n- outcomes", mapping: "PC1.1; FS reading", settingsJson: "" },
    { topic: "", order: 2, blockType: "Note / callout", content: "**Start with the organisational need.**\nA technically impressive solution can still be unsuitable.", mapping: "PC1.1", settingsJson: "" },
    { topic: "", order: 3, blockType: "Accordion", content: "**Common forms**\n\n**Project brief**\nA structured document.\n\n**Client request**\nA description of the desired result.", mapping: "KE formats", settingsJson: "" },
    { topic: "", order: 4, blockType: "Image", content: "**Suggested image:** A worker reviewing a project brief.\n\n**Alternative text:** Worker reviewing documents beside a laptop.\n\n**Caption:** Review the work brief before investigating.", mapping: "PC1.1", settingsJson: "" }
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.title, "Understanding the work brief");
  assert.equal(result.rows[0]?.block?.metadata?.mapping, "PC1.1; FS reading");
  assert.match(result.rows[0]?.previewHtml ?? "", /<h3>What is a work brief\?<\/h3>/);
  assert.equal(result.rows[3]?.block?.metadata?.imagePrompt, "A worker reviewing a project brief.");
  assert.ok(result.messages.some((message) => message.message === "Choose an image." && message.severity === "warning"));
});

test("rejects unknown block names, duplicate order and inconsistent titles", () => {
  const result = verifyStoryboardRows([
    { topic: "First", order: 1, blockType: "rich text", content: "Text", mapping: "", settingsJson: "" },
    { topic: "Second", order: 1, blockType: "Accordion", content: "", mapping: "", settingsJson: "" }
  ]);
  assert.equal(result.valid, false);
  assert.match(result.messages.map((message) => message.message).join(" "), /Unknown block type/);
  assert.match(result.messages.map((message) => message.message).join(" "), /duplicated/);
  assert.match(result.messages.map((message) => message.message).join(" "), /must remain/);
});

test("uses Settings JSON for a lossless widget round trip and removes image asset ids", () => {
  const block = createWidgetBlock("image"); block.params.imageAssetId = "local-only-asset"; block.params.altText = "A document"; block.metadata = { mapping: "PC1.1", imagePrompt: "A document on a desk" };
  const row = storyboardRowFromBlock("Images", block, 1);
  assert.equal((JSON.parse(row.settingsJson) as { params: { imageAssetId: string } }).params.imageAssetId, "");
  const result = verifyStoryboardRows([row]);
  assert.equal(result.valid, true);
  assert.equal(result.rows[0]?.block?.metadata?.mapping, "PC1.1");
  assert.equal(result.rows[0]?.block?.metadata?.imagePrompt, "A document on a desk");
});

test("blocks unsafe HTML supplied through Settings JSON", () => {
  const result = verifyStoryboardRows([{ topic: "Unsafe", order: 1, blockType: "Rich text", content: "", mapping: "", settingsJson: JSON.stringify({ html: '<img src="x" onerror="alert(1)">' }) }]);
  assert.equal(result.valid, false);
  assert.match(result.messages[0]?.message ?? "", /unsafe/);
});
