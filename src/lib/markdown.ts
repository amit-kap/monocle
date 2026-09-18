import type { Editor } from "@tiptap/react";

type MarkdownStorage = {
  markdown: {
    getMarkdown: () => string;
  };
};

export function toMarkdown(editor: Editor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
}
