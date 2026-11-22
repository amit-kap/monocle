import { Node, mergeAttributes } from "@tiptap/core";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import type MarkdownIt from "markdown-it";

// Raw HTML in a note is never rendered: that would let any file inject markup
// and CSS into the app. It is kept, shown as its own source and written back
// exactly as it was, so a `<details>` or `<kbd>` survives every save instead
// of turning into `&lt;details&gt;`.

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type MdWithFlag = MarkdownIt & { __monocleRawHtml?: boolean };

function setup(md: MdWithFlag) {
  if (md.__monocleRawHtml) return;
  md.__monocleRawHtml = true;
  md.set({ html: true });
  md.renderer.rules.html_inline = (tokens, idx) => {
    const html = tokens[idx].content;
    // The task-list plugin draws its checkbox as an html_inline token; that
    // one is ours, not the author's.
    if (/^<input[^>]*task-list-item-checkbox/.test(html)) return html;
    return `<span data-raw-html="${escapeAttr(html)}"></span>`;
  };
  md.renderer.rules.html_block = (tokens, idx) =>
    `<div data-raw-html-block="${escapeAttr(tokens[idx].content.replace(/\n+$/, ""))}"></div>`;
}

/** One inline tag, like `<kbd>` or `</kbd>`, kept as written. */
export const RawHtmlInline = Node.create({
  name: "rawHtmlInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      html: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-raw-html") ?? "",
        renderHTML: (attrs) => ({ "data-raw-html": attrs.html }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-raw-html]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "raw-html" }), node.attrs.html];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          state.write(node.attrs.html);
        },
        parse: { setup },
      },
    };
  },
});

/** A block of HTML (a `<details>`, a comment), kept and shown as written. */
export const RawHtmlBlock = Node.create({
  name: "rawHtmlBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      html: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-raw-html-block") ?? "",
        renderHTML: (attrs) => ({ "data-raw-html-block": attrs.html }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-raw-html-block]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["pre", mergeAttributes(HTMLAttributes, { class: "raw-html-block" }), node.attrs.html];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          state.write(node.attrs.html);
          state.closeBlock(node);
        },
        parse: { setup },
      },
    };
  },
});
