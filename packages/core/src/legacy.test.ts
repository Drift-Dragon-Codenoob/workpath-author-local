import assert from "node:assert/strict";
import test from "node:test";
import { importLegacyProject } from "./index.js";

test("imports original WorkPath JSON without silently dropping blocks", () => {
  const result = importLegacyProject({
    schemaVersion: "0.2",
    project: { id: "old", title: "Imported book", unitCode: "ABC123", version: "1", createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z" },
    bookSettings: { contentTopics: [{ id: "process", title: "Process", order: 1, enabled: true, role: "process" }] },
    assets: [{ id: "asset-1" }],
    learningObjects: [{ id: "topic-1", kind: "process", contentTopicId: "process", title: "Do the work", summary: "Purpose", order: 1, blocks: [
      { id: "text-1", type: "text", content: { html: "<p>Hello</p>" } },
      { id: "note-1", type: "note", content: { tone: "tip", title: "Tip", html: "<p>Carefully</p>" } },
      { id: "widget-1", type: "widget", content: { widgetKey: "core.cards", params: {} } }
    ] }]
  });
  assert.equal(result.project.title, "Imported book");
  assert.equal(result.project.unitCode, "ABC123");
  assert.equal(result.project.chapters[0]?.subchapters[0]?.blocks.length, 3);
  const note = result.project.chapters[0]?.subchapters[0]?.blocks[1];
  assert.equal(note?.type, "widget");
  assert.equal(note?.type === "widget" ? note.widgetKey : "", "note");
  assert.match(result.warnings.join(" "), /core.cards/);
  assert.match(result.warnings.join(" "), /1 media asset/);
});

test("rejects unrelated and unsupported JSON", () => {
  assert.throws(() => importLegacyProject({ hello: "world" }), /not a supported/);
  assert.throws(() => importLegacyProject({ schemaVersion: "9", project: {}, learningObjects: [] }), /Unsupported legacy schema/);
});
