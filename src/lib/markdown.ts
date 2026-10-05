import type { Editor } from "@tiptap/core";

type MarkdownStorage = {
  markdown: {
    getMarkdown: () => string;
  };
};

/**
 * The note as it should be written to disk: markdown with a trailing newline.
 *
 * The serializer drops it, but nearly every markdown file ends in one, and both
 * POSIX and git treat its absence as a change to the last line — so without this
 * every save shows a spurious "\ No newline at end of file" diff.
 */
export function toMarkdown(editor: Editor): string {
  const markdown = (editor.storage as unknown as MarkdownStorage).markdown
    .getMarkdown();
  if (markdown.length === 0 || markdown.endsWith("\n")) return markdown;
  return `${markdown}\n`;
}