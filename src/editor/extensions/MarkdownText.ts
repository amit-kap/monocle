import { Text } from "@tiptap/extension-text";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";

// tiptap-markdown escapes every `<` and `>` in text, so a typed `a -> b` saved
// as `a -&gt; b`. Only a `<` that would open a tag or an autolink on the next
// load needs escaping; everything else is written as typed.
export function escapeAngles(text: string): string {
  return text.replace(/<(?=[A-Za-z/!?])/g, "&lt;");
}

export const MarkdownText = Text.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          state.text(escapeAngles(node.text ?? ""));
        },
        parse: {},
      },
    };
  },
});
