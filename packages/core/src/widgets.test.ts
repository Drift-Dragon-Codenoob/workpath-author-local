import assert from "node:assert/strict";
import test from "node:test";
import { WIDGET_DEFINITIONS, createWidgetBlock, renderContentBlock, validateBlock } from "./index.js";

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

test("creates and renders every registered block definition", () => {
  assert.equal(WIDGET_DEFINITIONS.length, 20);
  for (const definition of WIDGET_DEFINITIONS) {
    const block = createWidgetBlock(definition.key);
    assert.equal(block.widgetKey, definition.key);
    assert.ok(renderContentBlock(block).trim(), `${definition.key} should render HTML`);
  }
});

test("sanitises custom HTML and constrains embedded video providers", () => {
  const custom = createWidgetBlock("custom-html");
  custom.params.html = '<p onclick="alert(1)">Safe text</p><script>alert(1)</script><iframe src="https://example.com"></iframe>';
  const html = renderContentBlock(custom);
  assert.match(html, /Safe text/); assert.doesNotMatch(html, /onclick|script|iframe/i);
  assert.match(validateBlock(custom)[0]?.message ?? "", /Custom HTML/);
  const video = createWidgetBlock("video-embed"); video.params.url = "https://www.youtube.com/watch?v=abc123";
  assert.match(renderContentBlock(video), /youtube-nocookie\.com\/embed\/abc123/); assert.deepEqual(validateBlock(video), []);
  video.params.url = "https://unapproved.example/video"; assert.match(validateBlock(video)[0]?.message ?? "", /approved/);
});

test("renders nested gallery assets with accessible image metadata", () => {
  const gallery = createWidgetBlock("image-gallery");
  gallery.params.images = [{ imageAssetId: "asset", altText: "Workshop equipment", caption: "Equipment layout" }];
  const html = renderContentBlock(gallery, [{ id: "asset", filename: "workshop.jpg", mimeType: "image/jpeg", size: 1, relativePath: "assets/originals/workshop.jpg" }]);
  assert.match(html, /assets\/asset-workshop\.jpg/); assert.match(html, /alt="Workshop equipment"/); assert.deepEqual(validateBlock(gallery), []);
});

test("renders visible alt text when an image asset is unavailable", () => {
  for (const key of ["image", "image-text", "hotspot-image"] as const) {
    const block = createWidgetBlock(key); block.params.altText = "Diagram of the workplace process";
    const html = renderContentBlock(block); assert.match(html, /role="img"/); assert.match(html, />Diagram of the workplace process</);
  }
  const gallery = createWidgetBlock("image-gallery"); gallery.params.images = [{ imageAssetId: "", altText: "Workshop overview", caption: "" }];
  assert.match(renderContentBlock(gallery), />Workshop overview</);
});

test("renders flip cards with an image front, text back and animated disclosure state", () => {
  const block = createWidgetBlock("flip-cards");
  block.params.cards = [{ imageAssetId: "asset", altText: "A worker checking a safety plan", backTitle: "Plan first", backBody: "<p>Review the hazards before work begins.</p>" }];
  const html = renderContentBlock(block, [{ id: "asset", filename: "safety-plan.jpg", mimeType: "image/jpeg", size: 1, relativePath: "assets/originals/safety-plan.jpg" }]);
  assert.match(html, /workpath-flip-card\[open\] \.workpath-flip-card-inner\{transform:rotateY\(180deg\)\}/);
  assert.match(html, /<img src="assets\/asset-safety-plan\.jpg" alt="A worker checking a safety plan"/);
  assert.match(html, /class="workpath-flip-card-face workpath-flip-card-back"><h3>Plan first<\/h3><p>Review the hazards/);
  assert.doesNotMatch(html, /frontTitle|frontBody/);
  assert.deepEqual(validateBlock(block), []);
});

test("keeps legacy flip-card front images compatible", () => {
  const block = createWidgetBlock("flip-cards");
  block.params.cards = [{ frontAssetId: "asset", altText: "Legacy image", backTitle: "Legacy answer", backBody: "<p>Preserved text.</p>" }];
  const html = renderContentBlock(block, [{ id: "asset", filename: "legacy.png", mimeType: "image/png", size: 1, relativePath: "assets/originals/legacy.png" }]);
  assert.match(html, /assets\/asset-legacy\.png/);
  assert.deepEqual(validateBlock(block), []);
});
