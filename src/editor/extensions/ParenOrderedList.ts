import { Extension, wrappingInputRule } from "@tiptap/core";

// Markdown reads "1)" as a list marker just like "1." — markdown-it already
// parses a file that way — but tiptap's ordered-list input rule only matches
// "1. ". Without this, typing "1) " leaves the text as typed and the list
// appears only on the next load, so the file says one thing and the editor
// another.
export const ParenOrderedList = Extension.create({
  name: "parenOrderedList",

  addInputRules() {
    const type = this.editor.schema.nodes.orderedList;
    if (!type) return [];
    return [
      wrappingInputRule({
        find: /^(\d+)\)\s$/,
        type,
        getAttributes: (match) => ({ start: +match[1] }),
        // Carry on the sequence when the typed number follows the last item,
        // the way the "1. " rule does.
        joinPredicate: (match, node) =>
          node.childCount + node.attrs.start === +match[1],
      }),
    ];
  },
});
