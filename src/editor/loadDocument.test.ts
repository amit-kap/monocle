import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { toMarkdown } from "../lib/markdown";
import { loadDocument } from "./loadDocument";

function makeEditor(): Editor {
  return new Editor({ extensions: [StarterKit, Markdown] });
}

describe("loadDocument", () => {
  it("does not let undo restore the previous note", () => {
    const editor = makeEditor();
    loadDocument(editor, "note A");
    editor.commands.insertContentAt(1, "edited ");
    loadDocument(editor, "note B");
    editor.commands.undo();
    expect(toMarkdown(editor)).toBe("note B");
    editor.destroy();
  });

  it("keeps undo working for edits made after loading", () => {
    const editor = makeEditor();
    loadDocument(editor, "# Title");
    editor.commands.insertContentAt(editor.state.doc.content.size, "body");
    expect(toMarkdown(editor)).toContain("body");
    editor.commands.undo();
    expect(toMarkdown(editor)).toBe("# Title");
    editor.destroy();
  });
});
