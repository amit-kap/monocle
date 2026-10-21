import { Extension, wrappingInputRule } from "@tiptap/core";

// markdown-it reads `1)` as an ordered-list marker as well as `1.`, so a note
// written with parens round-trips as a list. Typing no longer agreed: tiptap's
// input rule matches only the dot form, so `1) ` stayed literal text until the
// file was reopened. This rule mirrors tiptap's own, including the `start`
// attribute and the predicate that continues an existing sequence.
const PAREN_INPUT = /^(\d+)\)\s$/;

export const ParenNumberedList = Extension.create({
  name: "parenNumberedList",

  addInputRules() {
    return [
      wrappingInputRule({
        find: PAREN_INPUT,
        type: this.editor.schema.nodes.orderedList,
        getAttributes: (match) => ({ start: +match[1] }),
        joinPredicate: (match, node) =>
          (!node.attrs.type || node.attrs.type === "1") &&
          node.childCount + node.attrs.start === +match[1],
      }),
    ];
  },
});
