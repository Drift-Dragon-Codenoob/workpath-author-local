import assert from "node:assert/strict";
import test from "node:test";
import { createProject, migrateProject } from "./index.js";

test("migrates local 1.0 groups and HTML blocks to 1.3 chapters and subchapters", () => {
  const migrated = migrateProject({ schemaVersion: "1.0", id: "project", title: "Old local project", unitCode: "", revision: 4, createdAt: "now", updatedAt: "now", contentTopics: [{ id: "chapter", title: "Chapter", order: 1, enabled: true }], topics: [{ id: "topic", contentTopicId: "chapter", title: "Topic", summary: "", order: 1, blocks: [{ id: "block", type: "html", html: "<p>Keep me</p>" }] }], assets: [], theme: {} });
  assert.equal(migrated.schemaVersion, "1.3");
  assert.deepEqual(migrated.chapters[0]?.subchapters[0]?.blocks[0], { id: "block", type: "richText", html: "<p>Keep me</p>" });
  assert.equal(migrated.revision, 4);
});

test("upgrades fixed three-column tables to the dynamic table model", () => {
  const project = { schemaVersion: "1.1", id: "project", title: "Table project", unitCode: "", revision: 1, createdAt: "now", updatedAt: "now", contentTopics: [{ id: "chapter", title: "Chapter", order: 1, enabled: true }], topics: [{ id: "topic", contentTopicId: "chapter", title: "Topic", summary: "", order: 1, blocks: [{ id: "table", type: "widget", widgetKey: "table", definitionVersion: "1.0.0", params: { caption: "Old table", heading1: "A", heading2: "B", heading3: "C", rows: [{ cell1: "1", cell2: "2", cell3: "3" }] } }] }], assets: [], theme: {} };
  const migrated = migrateProject(project);
  const block = migrated.chapters[0]?.subchapters[0]?.blocks[0];
  assert.equal(block?.type, "widget");
  if (block?.type !== "widget") return;
  assert.deepEqual(block.params.columns, [{ heading: "A" }, { heading: "B" }, { heading: "C" }]);
  assert.deepEqual(block.params.rows, [{ cells: ["1", "2", "3"] }]);
  assert.equal(block.definitionVersion, "1.1.0");
});

test("migrates schema 1.2 projects to 1.3 without changing nested content", () => {
  const current = createProject("Current");
  const previous = { ...current, schemaVersion: "1.2" };
  const migrated = migrateProject(previous);
  assert.equal(migrated.schemaVersion, "1.3");
  assert.deepEqual(migrated.chapters, current.chapters);
});
