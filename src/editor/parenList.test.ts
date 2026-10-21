import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { toMarkdown } from "../lib/markdown";
import { makeTestEditor, onDisk } from "./testEditor";

/**
 * Types into the editor the way the view does: the input-rule plugin is asked
 * to handle the text before ProseMirror inserts it. Typing one character at a
 * time is the real sequence (the rule fires on the space).
 */
function type(editor: Editor, text: string) {
  for (const char of text) {
    const { from, to } = editor.view.state.selection;
    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(editor.view, from, to, char, () =>
        editor.view.state.tr.insertText(char),
      ),
    );
    if (!handled) editor.view.dispatch(editor.view.state.tr.insertText(char));
  }
}

describe("`1) ` numbered lists", () => {
  it("starts a list from the paren form", () => {
    const editor = makeTestEditor();
    type(editor, "1) ");
    type(editor, "first");
    expect(editor.getJSON().content?.[0].type).toBe("orderedList");
    expect(toMarkdown(editor)).toBe(onDisk("1. first"));
    editor.destroy();
  });

  it("keeps the dot form working", () => {
    const editor = makeTestEditor();
    type(editor, "1. ");
    type(editor, "first");
    expect(editor.getJSON().content?.[0].type).toBe("orderedList");
    editor.destroy();
  });

  it("continues the sequence: `2) ` joins the list above", () => {
    const editor = makeTestEditor();
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "one" }] },
              ],
            },
          ],
        },
        { type: "paragraph" },
      ],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    type(editor, "2) ");
    type(editor, "two");
    // StarterKit's trailing node keeps an empty paragraph after a list at the
    // end of the doc; the list itself must stay one list.
    const doc = editor.getJSON().content ?? [];
    expect(doc.map((node) => node.type)).toEqual(["orderedList", "paragraph"]);
    expect(doc[0].content).toHaveLength(2);
    expect(toMarkdown(editor)).toBe(onDisk("1. one\n2. two"));
    editor.destroy();
  });

  it("starts at the number that was typed", () => {
    const editor = makeTestEditor();
    type(editor, "3) three");
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "orderedList",
      attrs: { start: 3 },
    });
    expect(toMarkdown(editor)).toBe(onDisk("3. three"));
    editor.destroy();
  });

  it("leaves a paren without a space as text", () => {
    const editor = makeTestEditor();
    type(editor, "1)not a list");
    expect(editor.getJSON().content?.[0].type).toBe("paragraph");
    expect(toMarkdown(editor)).toBe(onDisk("1)not a list"));
    editor.destroy();
  });
});
