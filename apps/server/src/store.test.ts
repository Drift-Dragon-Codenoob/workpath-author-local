import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createProject, createWidgetBlock } from "@workpath/core";
import { applyImportedImagePlaceholders, createStoredProject, deleteStoredProject, projectsRoot } from "./store.js";

test("assigns one shared placeholder to required imported image slots", () => {
  const project = createProject("Placeholder test");
  const image = createWidgetBlock("image");
  const imageText = createWidgetBlock("image-text");
  const hotspot = createWidgetBlock("hotspot-image");
  const gallery = createWidgetBlock("image-gallery");
  const cards = createWidgetBlock("card-grid");
  project.chapters[0]!.blocks = [image, imageText, hotspot, gallery, cards];
  const result = applyImportedImagePlaceholders(project.chapters, "placeholder-id");
  assert.equal(result.used, true);
  const blocks = result.chapters[0]!.blocks;
  for (const block of blocks.slice(0, 3)) assert.equal(block.type === "widget" ? block.params.imageAssetId : "", "placeholder-id");
  const importedGallery = blocks[3]!; assert.ok(importedGallery.type === "widget");
  assert.ok((importedGallery.params.images as Array<{ imageAssetId?: string }>).every((entry) => entry.imageAssetId === "placeholder-id"));
  const importedCards = blocks[4]!; assert.ok(importedCards.type === "widget");
  assert.ok((importedCards.params.cards as Array<{ imageAssetId?: string }>).every((entry) => !entry.imageAssetId));
});

test("does not replace image selections already present", () => {
  const project = createProject("Existing image"); const image = createWidgetBlock("image"); image.params.imageAssetId = "existing"; project.chapters[0]!.blocks = [image];
  const result = applyImportedImagePlaceholders(project.chapters, "placeholder-id");
  assert.equal(result.used, false); const imported = result.chapters[0]!.blocks[0]!; assert.equal(imported.type === "widget" ? imported.params.imageAssetId : "", "existing");
});

test("keeps an image slot asset-free when imported alt text is available", () => {
  const project = createProject("Alt text fallback"); const image = createWidgetBlock("image-text"); image.params.altText = "A technician reviewing a work request"; project.chapters[0]!.blocks = [image];
  const result = applyImportedImagePlaceholders(project.chapters, "placeholder-id");
  assert.equal(result.used, false); const imported = result.chapters[0]!.blocks[0]!; assert.ok(imported.type === "widget"); assert.equal(imported.params.imageAssetId, ""); assert.equal(imported.params.altText, "A technician reviewing a work request");
});

test("deletes a stored project and its complete project folder", async () => {
  const created = await createStoredProject(`Deletion test ${crypto.randomUUID()}`);
  const projectFolder = path.join(projectsRoot, created.id);
  await access(projectFolder);
  const deleted = await deleteStoredProject(created.id);
  assert.equal(deleted.id, created.id);
  await assert.rejects(access(projectFolder));
});
