import { describe, expect, it } from "vitest";
import { makeTestEditor, onDisk } from "./testEditor";
import { toMarkdown } from "../lib/markdown";
import {
  canInsertAt,
  movableBlocks,
  moveBlockTo,
  moveSibling,
} from "./blockUtils";

// Layout-dependent helpers (blockAt, blockAtY, dropTargetForY) read
// getBoundingClientRect, which jsdom reports as all zeroes, so they are not
// covered here. The position arithmetic and the move logic are.

const DOC = ["intro", "", "- one", "- two", "", "outro"].join("\n");

function blocks(markdown: string) {
  const editor = makeTestEditor(markdown);
  const list = movableBlocks(editor.state.doc).map((b) => ({
    from: b.from,
    to: b.to,
    depth: b.depth,
    type: b.node.type.name,
    text: b.node.textContent,
  }));
  editor.destroy();
  return list;
}

describe("movableBlocks", () => {
  it("lists top-level blocks and individual list items", () => {
    const found = blocks(DOC);
    expect(found.map((b) => `${b.depth}:${b.type}`)).toEqual([
      "0:paragraph",
      "0:bulletList",
      "1:listItem",
      "1:listItem",
      "0:paragraph",
    ]);
  });

  it("gives list items their own ranges", () => {
    const found = blocks(DOC);
    const items = found.filter((b) => b.depth === 1);
    expect(items.map((b) => b.text)).toEqual(["one", "two"]);
    // Sibling ranges must not overlap.
    expect(items[0].to).toBeLessThanOrEqual(items[1].from);
  });

  it("treats task items as movable too", () => {
    const found = blocks("- [ ] a\n- [x] b\n");
    expect(found.filter((b) => b.depth === 1).map((b) => b.type)).toEqual([
      "taskItem",
      "taskItem",
    ]);
  });

  it("descends into nested lists so deep items get their own handle", () => {
    const found = blocks("- one\n  - two\n    - three\n");
    // The outer list is a top-level block; the nested lists are not emitted at
    // all (they travel with their parent item), only their items.
    expect(found.map((b) => `${b.depth}:${b.type}`)).toEqual([
      "0:bulletList",
      "1:listItem",
      "2:listItem",
      "3:listItem",
    ]);
    // An item's text includes its nested content, because it owns it.
    expect(found[3].text).toBe("three");
  });

  it("keeps nested list levels consecutive", () => {
    const found = blocks("- a\n  - b\n    - c\n      - d\n");
    const itemLevels = found.filter((b) => b.type === "listItem").map((b) => b.depth);
    expect(itemLevels).toEqual([1, 2, 3, 4]);
  });

  it("does not emit the paragraphs inside a list item", () => {
    const found = blocks("- a\n  - b\n");
    // Only lists and items, so a paragraph inside an item never gets its own
    // handle.
    expect(found.some((b) => b.type === "paragraph")).toBe(false);
  });

  it("handles an ordered list", () => {
    const found = blocks("1. a\n2. b\n");
    expect(found.filter((b) => b.depth === 1)).toHaveLength(2);
  });
});

describe("canInsertAt", () => {
  it("accepts a paragraph at the top level", () => {
    const editor = makeTestEditor("hello\n");
    const paragraph = editor.state.doc.child(0);
    expect(canInsertAt(editor.state.doc, 0, paragraph)).toBe(true);
    editor.destroy();
  });

  it("rejects a list item at the top level", () => {
    const editor = makeTestEditor("hello\n");
    const list = editor.state.doc.child(0);
    const item = list.child(0);
    expect(canInsertAt(editor.state.doc, 0, item)).toBe(false);
    editor.destroy();
  });

  it("rejects an out-of-range position", () => {
    const editor = makeTestEditor("hello\n");
    const paragraph = editor.state.doc.child(0);
    expect(canInsertAt(editor.state.doc, -1, paragraph)).toBe(false);
    expect(canInsertAt(editor.state.doc, 9999, paragraph)).toBe(false);
    editor.destroy();
  });
});

describe("moveBlockTo", () => {
  it("moves a single list item above its sibling", () => {
    const editor = makeTestEditor(DOC);
    const items = movableBlocks(editor.state.doc).filter((b) => b.depth === 1);
    const second = items[1];
    moveBlockTo(editor, second.from, second.to, items[0].from);
    expect(toMarkdown(editor)).toBe(onDisk("intro\n\n- two\n- one\n\noutro"));
    editor.destroy();
  });

  it("promotes a list item to a paragraph when dropped at the top level", () => {
    const editor = makeTestEditor("intro\n\n- one\n- two\n");
    const items = movableBlocks(editor.state.doc).filter((b) => b.depth === 1);
    const first = items[0];
    moveBlockTo(editor, first.from, first.to, 0);
    // A listItem cannot be a child of the document, so the drag converts it to
    // a paragraph rather than being refused.
    expect(toMarkdown(editor)).toBe(onDisk("one\n\nintro\n\n- two"));
    editor.destroy();
  });

  it("wraps a paragraph into a list item when dropped into a list", () => {
    const editor = makeTestEditor("intro\n\n- one\n\ntail\n");
    const para = movableBlocks(editor.state.doc).find(
      (b) => b.depth === 0 && b.node.textContent === "intro",
    )!;
    const item = movableBlocks(editor.state.doc).find((b) => b.depth === 1)!;
    moveBlockTo(editor, para.from, para.to, item.from);
    // Dropping *at* an item means above it, which is where the drop line shows.
    expect(toMarkdown(editor)).toBe(onDisk("- intro\n- one\n\ntail"));
    editor.destroy();
  });

  it("drops the list when its last item is moved away", () => {
    const editor = makeTestEditor("intro\n\n- only\n\noutro\n");
    const item = movableBlocks(editor.state.doc).find((b) => b.depth === 1)!;
    moveBlockTo(editor, item.from, item.to, 0);
    // An emptied bulletList is not a valid document, so it must be gone.
    expect(toMarkdown(editor)).toBe(onDisk("only\n\nintro\n\noutro"));
    editor.destroy();
  });

  it("refuses a drop inside a paragraph and leaves the document untouched", () => {
    const editor = makeTestEditor("hello world\n");
    const before = toMarkdown(editor);
    // Position 3 is between characters, where no block can be inserted.
    moveBlockTo(editor, 0, editor.state.doc.child(0).nodeSize, 3);
    expect(toMarkdown(editor)).toBe(before);
    editor.destroy();
  });

  it("moves a task item without disturbing its checkbox", () => {
    const editor = makeTestEditor("- [ ] a\n- [x] b\n");
    const items = movableBlocks(editor.state.doc).filter((b) => b.depth === 1);
    moveBlockTo(editor, items[1].from, items[1].to, items[0].from);
    expect(toMarkdown(editor)).toBe(onDisk("- [x] b\n- [ ] a"));
    editor.destroy();
  });

  it("keeps a nested sublist attached to its parent item", () => {
    const editor = makeTestEditor("- parent\n  - child\n- other\n");
    const items = movableBlocks(editor.state.doc).filter((b) => b.depth === 1);
    moveBlockTo(editor, items[0].from, items[0].to, items[1].to);
    expect(toMarkdown(editor)).toBe(onDisk("- other\n- parent\n  - child"));
    editor.destroy();
  });
});

describe("moveSibling", () => {
  it("moves a block up among top-level siblings", () => {
    const editor = makeTestEditor("a\n\nb\n\nc\n");
    const blocksList = movableBlocks(editor.state.doc);
    moveSibling(editor, blocksList[1].from, blocksList[1].to, -1);
    expect(toMarkdown(editor)).toBe(onDisk("b\n\na\n\nc"));
    editor.destroy();
  });

  it("moves a block down among top-level siblings", () => {
    const editor = makeTestEditor("a\n\nb\n\nc\n");
    const blocksList = movableBlocks(editor.state.doc);
    moveSibling(editor, blocksList[1].from, blocksList[1].to, 1);
    expect(toMarkdown(editor)).toBe(onDisk("a\n\nc\n\nb"));
    editor.destroy();
  });

  it("does nothing at the first sibling", () => {
    const editor = makeTestEditor("a\n\nb\n");
    const before = toMarkdown(editor);
    const blocksList = movableBlocks(editor.state.doc);
    moveSibling(editor, blocksList[0].from, blocksList[0].to, -1);
    expect(toMarkdown(editor)).toBe(before);
    editor.destroy();
  });

  it("reorders list items among themselves, not across the list", () => {
    const editor = makeTestEditor("head\n\n- a\n- b\n\ntail\n");
    const items = movableBlocks(editor.state.doc).filter((b) => b.depth === 1);
    moveSibling(editor, items[1].from, items[1].to, -1);
    expect(toMarkdown(editor)).toBe(onDisk("head\n\n- b\n- a\n\ntail"));
    editor.destroy();
  });

  it("does not move a list item past the end of its list", () => {
    const editor = makeTestEditor("head\n\n- a\n- b\n");
    const before = toMarkdown(editor);
    const items = movableBlocks(editor.state.doc).filter((b) => b.depth === 1);
    moveSibling(editor, items[1].from, items[1].to, 1);
    expect(toMarkdown(editor)).toBe(before);
    editor.destroy();
  });
});