import { describe, expect, it } from "vitest";
import { toMarkdown } from "../lib/markdown";
import { makeTestEditor, onDisk } from "./testEditor";
import { loadDocument } from "./loadDocument";

describe("loadDocument", () => {
  it("does not let undo restore the previous note", () => {
    const editor = makeTestEditor();
    loadDocument(editor, "note A");
    editor.commands.insertContentAt(1, "edited ");
    loadDocument(editor, "note B");
    editor.commands.undo();
    expect(toMarkdown(editor)).toBe(onDisk("note B"));
    editor.destroy();
  });

  it("keeps undo working for edits made after loading", () => {
    const editor = makeTestEditor();
    loadDocument(editor, "# Title");
    editor.commands.insertContentAt(editor.state.doc.content.size, "body");
    expect(toMarkdown(editor)).toContain("body");
    editor.commands.undo();
    expect(toMarkdown(editor)).toBe(onDisk("# Title"));
    editor.destroy();
  });
});
