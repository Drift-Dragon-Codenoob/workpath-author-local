import assert from "node:assert/strict";
import test from "node:test";
import { WIDGET_DEFINITIONS, createWidgetBlock, renderContentBlock } from "@workpath/core";
import { recoverContentBlocks } from "./htmlBlockRecovery.js";

test("recognises every built-in WorkPath block emitted by the compiler", () => {
  for (const definition of WIDGET_DEFINITIONS) {
    const original = createWidgetBlock(definition.key);
    const recovered = recoverContentBlocks(renderContentBlock(original));
    assert.equal(recovered.structuredCount, 1, `${definition.key} should be reconstructed`);
    assert.equal(recovered.blocks.length, 1, `${definition.key} should not create stray rich text`);
    const block = recovered.blocks[0];
    assert.equal(block?.type, "widget");
    if (block?.type === "widget") assert.equal(block.widgetKey, definition.key);
  }
});

test("keeps normal HTML around widgets as separate rich-text blocks", () => {
  const note = createWidgetBlock("note");
  const recovered = recoverContentBlocks(`<p>Before</p>${renderContentBlock(note)}<p>After</p>`);
  assert.deepEqual(recovered.blocks.map((block) => block.type === "widget" ? block.widgetKey : block.html), ["<p>Before</p>", "note", "<p>After</p>"]);
});
