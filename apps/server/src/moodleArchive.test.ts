import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import JSZip from "jszip";
import tar from "tar-stream";
import { assetPackagePath, compileMoodleBook, createProject, createWidgetBlock } from "@workpath/core";
import { parseMoodleArchive } from "./moodleArchive.js";

test("imports a Moodle Book chapter ZIP with subchapters and local assets", async () => {
  const zip = new JSZip();
  zip.file("01-00-first.html", '<html><head><title>First chapter</title></head><body><main class="workpath-book"><h1>First chapter</h1><p><strong>Purpose:</strong> Introduces the book.</p><p>Opening text.</p><aside class="workpath-note workpath-note--warning"><h3>Take care</h3><p>Check first.</p></aside><figure class="workpath-image"><img src="assets/diagram.png" onerror="alert(1)" alt="Diagram"><figcaption>A diagram</figcaption></figure><figure class="workpath-table"><table><caption>Results</caption><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></figure><script>alert(1)</script></main></body></html>');
  zip.file("01-01-detail_sub.html", '<html><head><title>Detail</title></head><body><main class="workpath-book"><h1>Detail</h1><p>Subchapter</p></main></body></html>');
  zip.file("assets/diagram.png", new Uint8Array([1, 2, 3]));
  const result = await parseMoodleArchive(await zip.generateAsync({ type: "uint8array" }), "example-moodle-book.zip", "imported-project");
  assert.equal(result.title, "Example"); assert.equal(result.chapters.length, 1); assert.equal(result.chapters[0]?.subchapters.length, 1); assert.equal(result.assets.length, 1);
  assert.equal(result.chapters[0]?.summary, "Introduces the book.");
  const blocks = result.chapters[0]!.blocks; assert.deepEqual(blocks.map((block) => block.type === "widget" ? block.widgetKey : "richText"), ["richText", "note", "image", "table"]);
  const note = blocks[1]; assert.equal(note?.type, "widget"); if (note?.type === "widget") assert.deepEqual(note.params, { tone: "warning", title: "Take care", html: "<p>Check first.</p>" });
  const image = blocks[2]; assert.equal(image?.type, "widget"); if (image?.type === "widget") { assert.equal(image.params.imageAssetId, result.assets[0]?.id); assert.equal(image.params.altText, "Diagram"); }
  assert.doesNotMatch(JSON.stringify(blocks), /script|onerror/i);
  assert.match(result.warnings.join(" "), /3 structured/);
});

test("restores exact editable data from a future WorkPath Moodle export", async () => {
  const project = createProject("Round trip"); const note = createWidgetBlock("note"); note.params.title = "Exact note";
  const asset = { id: crypto.randomUUID(), filename: "picture.png", mimeType: "image/png", size: 3, relativePath: "assets/originals/picture.png" };
  project.unitCode = "ICTTEST"; project.assets = [asset]; project.chapters[0]!.blocks = [note]; project.blockTemplates = [{ id: crypto.randomUUID(), name: "Reusable note", block: note, createdAt: "now", updatedAt: "now" }];
  const compiled = await compileMoodleBook({ project, readAsset: async () => new Uint8Array([7, 8, 9]) });
  const result = await parseMoodleArchive(compiled.bytes, "round-trip.zip", "new-project");
  assert.equal(result.unitCode, "ICTTEST"); assert.deepEqual(result.chapters, project.chapters); assert.deepEqual(result.blockTemplates, project.blockTemplates); assert.deepEqual(result.theme, project.theme);
  assert.equal(result.assets[0]?.id, asset.id); assert.equal(result.assets[0]?.relativePath, `assets/originals/${asset.id}-picture.png`); assert.deepEqual([...result.assets[0]!.bytes], [7, 8, 9]);
  assert.match(result.warnings[0]!, /exact editable blocks/); assert.equal(assetPackagePath(asset), `assets/${asset.id}-picture.png`);
});

test("imports Book chapters and files from a ZIP-based Moodle backup", async () => {
  const zip = new JSZip(); const hash = "abcdef0123456789";
  zip.file("moodle_backup.xml", "<moodle_backup></moodle_backup>");
  zip.file("activities/book_1/book.xml", "<activity><book><name>Recovered Book</name></book></activity>");
  zip.file("activities/book_1/chapters.xml", '<chapters><chapter><id>7</id><subchapter>0</subchapter><title>Recovered chapter</title><content>&lt;p&gt;&lt;img src=&quot;@@PLUGINFILE@@/image.png&quot; alt=&quot;Image&quot;&gt;&lt;/p&gt;</content><hidden>0</hidden></chapter></chapters>');
  zip.file("files.xml", `<files><file><contenthash>${hash}</contenthash><filename>image.png</filename><filepath>/</filepath><itemid>7</itemid></file></files>`);
  zip.file(`files/${hash.slice(0, 2)}/${hash}`, new Uint8Array([4, 5, 6]));
  const result = await parseMoodleArchive(await zip.generateAsync({ type: "uint8array" }), "backup.mbz", "mbz-project");
  assert.equal(result.title, "Recovered Book"); assert.equal(result.chapters[0]?.title, "Recovered chapter"); assert.equal(result.assets.length, 1);
  const block = result.chapters[0]?.blocks[0]; assert.equal(block?.type, "richText"); if (block?.type === "richText") assert.match(block.html, /\/api\/projects\/mbz-project\/assets\//);
});

test("imports the default TGZ-based Moodle backup format", async () => {
  const pack = tar.pack(); const chunks: Buffer[] = []; const packed = new Promise<Buffer>((resolve, reject) => { pack.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk))); pack.once("end", () => resolve(Buffer.concat(chunks))); pack.once("error", reject); });
  pack.entry({ name: "moodle_backup.xml" }, "<moodle_backup></moodle_backup>");
  pack.entry({ name: "activities/book_2/book.xml" }, "<activity><book><name>TGZ Book</name><chapters><chapter id=\"2\"><subchapter>0</subchapter><title>TGZ chapter</title><content>&lt;p&gt;Recovered&lt;/p&gt;</content><hidden>0</hidden></chapter></chapters></book></activity>");
  pack.finalize();
  const result = await parseMoodleArchive(gzipSync(await packed), "backup.mbz", "tgz-project");
  assert.equal(result.title, "TGZ Book"); assert.equal(result.chapters[0]?.title, "TGZ chapter");
});

test("reconstructs an approved WorkPath video while removing unsafe iframe attributes", async () => {
  const zip = new JSZip();
  zip.file("01-00-video.html", '<html><title>Video</title><body><main class="workpath-book"><h1>Video</h1><section class="workpath-video"><h3>Watch this</h3><div><iframe src="https://www.youtube-nocookie.com/embed/abc123" title="Demo" onload="alert(1)"></iframe></div><p>Introduction.</p></section></main></body></html>');
  const result = await parseMoodleArchive(await zip.generateAsync({ type: "uint8array" }), "video.zip", "video-project"); const block = result.chapters[0]!.blocks[0]!;
  assert.equal(block.type, "widget"); if (block.type === "widget") { assert.equal(block.widgetKey, "video-embed"); assert.equal(block.params.url, "https://www.youtube.com/watch?v=abc123"); assert.doesNotMatch(block.fallbackHtml || "", /onload/); }
});
