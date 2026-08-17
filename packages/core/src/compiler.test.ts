import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { compileMoodleBook, createProject, createWidgetBlock } from "./index.js";

test("compiles chapters and _sub topics for Moodle Book import", async () => {
  const project = createProject("Test book");
  project.chapters[0]!.title = "Process learning";
  project.chapters[0]!.subchapters.push({ id: crypto.randomUUID(), title: "First topic", summary: "Purpose", order: 1, blocks: [{ id: crypto.randomUUID(), type: "richText", html: "<p>Hello</p>", metadata: { mapping: "PRIVATE-MAPPING" } }] });
  const result = await compileMoodleBook({ project, readAsset: async () => new Uint8Array() });
  const zip = await JSZip.loadAsync(result.bytes);
  assert.ok(zip.file("01-00-process-learning.html"));
  assert.ok(zip.file("01-01-first-topic_sub.html"));
  const html = await zip.file("01-01-first-topic_sub.html")!.async("text");
  assert.match(html, /class="workpath-page" style="background:/);
  assert.match(html, /max-width:980px;padding:50px 60px/);
  assert.match(html, /border-left:4px solid #6f87a5/);
  assert.doesNotMatch(html, /PRIVATE-MAPPING/);
  const source = JSON.parse(await zip.file("workpath-source.json")!.async("text"));
  assert.equal(source.format, "workpath-source");
  assert.equal(source.version, 1);
  assert.deepEqual(source.project.chapters, project.chapters);
  assert.match(result.report.join(" "), /Moodle Book import: ready/);
});

test("packages image assets at the exact path used by widget HTML", async () => {
  const project = createProject("Image book");
  const asset = { id: crypto.randomUUID(), filename: "safety photo.png", mimeType: "image/png", size: 3, relativePath: "assets/originals/safety.png" };
  project.assets.push(asset);
  project.chapters[0]!.title = "Image topic";
  project.chapters[0]!.blocks = [{ id: crypto.randomUUID(), type: "widget", widgetKey: "image", definitionVersion: "1.0.0", params: { imageAssetId: asset.id, altText: "Safety equipment", caption: "Correct PPE" } }];
  const result = await compileMoodleBook({ project, readAsset: async () => new Uint8Array([1, 2, 3]) });
  const zip = await JSZip.loadAsync(result.bytes);
  const path = `assets/${asset.id}-safety-photo.png`;
  assert.ok(zip.file(path));
  assert.match(await zip.file("01-00-image-topic.html")!.async("text"), new RegExp(path.replaceAll(".", "\\.")));
  assert.equal(Object.keys(zip.files).filter((name) => name.endsWith("_sub.html")).length, 0);
  assert.match(result.report.join(" "), /0 subchapter/);
});

test("exports Moodle books with visible fallbacks for missing images", async () => {
  const project = createProject("Fallback book");
  const withAlt = createWidgetBlock("image-text"); withAlt.params.altText = "Technician reviewing a workplace request";
  const placeholder = createWidgetBlock("image");
  const flipCards = createWidgetBlock("flip-cards"); flipCards.params.cards = [{ imageAssetId: "", altText: "A team discussing the plan", backTitle: "Discuss the plan", backBody: "<p>Confirm responsibilities before starting.</p>" }];
  project.chapters[0]!.blocks = [withAlt, placeholder, flipCards];
  const result = await compileMoodleBook({ project, readAsset: async () => new Uint8Array() });
  const zip = await JSZip.loadAsync(result.bytes); const html = await zip.file("01-00-chapter-1.html")!.async("text");
  assert.match(html, />Technician reviewing a workplace request</); assert.match(html, />Placeholder image</); assert.match(html, />A team discussing the plan</); assert.match(html, /rotateY\(180deg\)/);
  assert.ok(result.report.some((entry) => entry.includes("Warning:") && entry.includes("Choose an image")));
});

test("still blocks an uploaded image that has no alternative text", async () => {
  const project = createProject("Unsafe image"); const image = createWidgetBlock("image"); image.params.imageAssetId = "asset"; project.chapters[0]!.blocks = [image];
  await assert.rejects(() => compileMoodleBook({ project, readAsset: async () => new Uint8Array() }), /Alternative text is required/);
});
