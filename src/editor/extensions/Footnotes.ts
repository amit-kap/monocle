import { Node, mergeAttributes } from "@tiptap/core";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import type MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import { Plugin, TextSelection } from "@tiptap/pm/state";

// GitHub footnotes: `Text[^1]` and, anywhere in the note, `[^1]: The note.`
//
// markdown-it-footnote normally gathers every definition into a list at the
// end and drops any that nothing references. Both would rewrite the file, so
// its tail step is switched off: each definition stays where the author wrote
// it, used or not. Inline footnotes (`^[…]`) are not GitHub markdown and stay
// plain text.

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

type MdWithFlag = MarkdownIt & { __monocleFootnotes?: boolean };

function setup(md: MdWithFlag) {
  if (md.__monocleFootnotes) return;
  md.__monocleFootnotes = true;
  md.use(footnote);
  md.core.ruler.disable("footnote_tail");
  md.inline.ruler.disable("footnote_inline");
  md.renderer.rules.footnote_ref = (tokens, idx) =>
    `<sup data-footnote-ref="${escapeAttr(tokens[idx].meta.label ?? String(tokens[idx].meta.id + 1))}"></sup>`;
  md.renderer.rules.footnote_reference_open = (tokens, idx) =>
    `<div data-footnote-def="${escapeAttr(tokens[idx].meta.label)}">`;
  md.renderer.rules.footnote_reference_close = () => "</div>";
}

/** The `[^label]` marker in running text. */
export const FootnoteRef = Node.create({
  name: "footnoteRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      label: {
        default: "1",
        parseHTML: (el) => el.getAttribute("data-footnote-ref") ?? "1",
        renderHTML: (attrs) => ({ "data-footnote-ref": attrs.label }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "sup[data-footnote-ref]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes, { class: "footnote-ref" }), node.attrs.label];
  },
  // A click on the marker puts the caret at the end of its definition.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClickOn(view, _pos, node) {
            if (node.type.name !== "footnoteRef") return false;
            let end = -1;
            view.state.doc.descendants((n, p) => {
              if (end < 0 && n.type.name === "footnoteDef" && n.attrs.label === node.attrs.label) {
                end = p + n.nodeSize - 2;
              }
            });
            if (end < 0) return false;
            const sel = TextSelection.near(view.state.doc.resolve(end), -1);
            view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
            view.focus();
            return true;
          },
        },
      }),
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          state.write(`[^${node.attrs.label}]`);
        },
        parse: { setup },
      },
    };
  },
});

/** The `[^label]: …` definition, with its own blocks. */
export const FootnoteDef = Node.create({
  name: "footnoteDef",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      label: {
        default: "1",
        parseHTML: (el) => el.getAttribute("data-footnote-def") ?? "1",
        renderHTML: (attrs) => ({ "data-footnote-def": attrs.label }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-footnote-def]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "footnote-def" }), 0];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          state.wrapBlock("    ", `[^${node.attrs.label}]: `, node, () => state.renderContent(node));
        },
        parse: { setup },
      },
    };
  },
});

/** The next free numeric label in a document. */
export function nextFootnoteLabel(doc: PMNode): string {
  let max = 0;
  doc.descendants((node) => {
    if (node.type.name === "footnoteRef" || node.type.name === "footnoteDef") {
      const n = Number(node.attrs.label);
      if (Number.isInteger(n) && n > max) max = n;
    }
  });
  return String(max + 1);
}
