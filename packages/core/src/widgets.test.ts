import assert from "node:assert/strict";
import test from "node:test";
import { createWidgetBlock, renderContentBlock, validateBlock } from "./index.js";

test("creates and renders a widget from the shared registry", () => {
  const block = createWidgetBlock("accordion");
  const html = renderContentBlock(block);
  assert.match(html, /<details style=/);
  assert.match(html, /Section 1/);
  assert.deepEqual(validateBlock(block), []);
});

test("preserves fallback output for a missing widget", () => {
  const block = { id: "missing", type: "widget" as const, widgetKey: "retired-widget", definitionVersion: "1", params: {}, fallbackHtml: "<p>Preserved</p>" };
  assert.equal(renderContentBlock(block), "<p>Preserved</p>");
  assert.match(validateBlock(block)[0]?.message ?? "", /missing/);
});

test("renders accessible table headings and repeatable rows", () => {
  const block = createWidgetBlock("table");
  const html = renderContentBlock(block);
  assert.match(html, /<caption style="[^"]+">Table summary<\/caption>/);
  assert.match(html, /<th scope="col" style="[^"]+">Column 1<\/th>/);
  assert.match(html, /<tbody><tr><td style="[^"]+"><\/td>/);
  assert.deepEqual(validateBlock(block), []);
  block.params.columns = [{ heading: "Only column" }];
  assert.match(validateBlock(block)[0]?.message ?? "", /column count/);
});

test("validates image selection and alternative text", () => {
  const block = createWidgetBlock("image");
  assert.deepEqual(validateBlock(block).map((issue) => issue.message), ["Choose an image.", "Alternative text is required."]);
  block.params.imageAssetId = "asset";
  block.params.altText = "A learner using safety equipment";
  assert.deepEqual(validateBlock(block), []);
});

test("renders critical widget layout as inline styles for Moodle imports", () => {
  const note = createWidgetBlock("note");
  assert.match(renderContentBlock(note), /style="background:#eef6ff;border-left:5px solid #4b79ad/);
  const imageText = createWidgetBlock("image-text");
  imageText.params.position = "right";
  imageText.params.imageAssetId = "asset";
  imageText.params.altText = "Example";
  imageText.params.showBorder = true;
  const html = renderContentBlock(imageText, [{ id: "asset", filename: "example.png", mimeType: "image/png", size: 1, relativePath: "assets/originals/example.png" }]);
  assert.match(html, /<table role="presentation"/);
  assert.match(html, /<td width="60%"/);
  assert.match(html, /<td width="40%"[^>]+padding:0 0 0 24px/);
  assert.match(html, /border:1px solid #aebbc9;padding:4px/);
});
