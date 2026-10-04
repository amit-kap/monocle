import { Extension } from "@tiptap/core";

type MarkdownItLike = { renderer: { rules: Record<string, unknown> } };

type SpecContext = {
  editor: { storage: Record<string, unknown> };
};

// tiptap-markdown renders markdown-it to HTML, then hands that HTML to
// ProseMirror. With `breaks: false` markdown-it emits a soft line break as a
// bare "\n", and MarkdownParser.normalizeDOM then deletes any "\n" that
// directly follows an inline element — that newline is the only whitespace
// between the two words, so the text is glued together and the damage is
// written back to disk on the next save:
//
//     Some **bold**   ->  <p>Some <strong>bold</strong>next line</p>
//     next line
//
// Emitting a real space instead of "\n" renders identically (HTML collapses
// whitespace runs) and survives normalizeDOM's cleanup.
export const SoftBreakSpace = Extension.create({
  name: "softBreakSpace",

  addStorage() {
    return {
      markdown: {
        parse: {
          setup(this: SpecContext, md: MarkdownItLike) {
            const storage = this.editor.storage as {
              markdown?: { options?: { breaks?: boolean } };
            };
            // With `breaks: true` markdown-it emits <br>; leave that alone.
            if (storage.markdown?.options?.breaks) return;
            md.renderer.rules.softbreak = () => " ";
          },
        },
      },
    };
  },
});