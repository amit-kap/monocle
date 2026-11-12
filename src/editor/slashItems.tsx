import type { Editor, Range } from "@tiptap/core";
import type { ReactNode } from "react";

export type SlashItem = {
  title: string;
  keywords: string[];
  icon: ReactNode;
  run: (editor: Editor, range: Range) => void;
};

function Glyph({ children }: { children: ReactNode }) {
  return <span className="slash-glyph">{children}</span>;
}

function chain(editor: Editor, range: Range) {
  return editor.chain().focus().deleteRange(range);
}

// The block menu offers the blocks that have no shortcut worth remembering.
// Headings, lists, quotes and rules come from markdown shortcuts as you type
// (`## `, `- `, `> `, `---`). A Mermaid diagram block comes after v1.
export const slashItems: SlashItem[] = [
  {
    title: "Table",
    keywords: ["table", "grid", "rows", "columns"],
    icon: <Glyph>▦</Glyph>,
    run: (editor, range) =>
      chain(editor, range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Task list",
    keywords: ["todo", "task", "checkbox", "check", "list"],
    icon: <Glyph>☐</Glyph>,
    run: (editor, range) => chain(editor, range).toggleTaskList().run(),
  },
  {
    title: "Code block",
    keywords: ["code", "pre", "snippet", "mono"],
    icon: <Glyph>{"</>"}</Glyph>,
    run: (editor, range) => chain(editor, range).toggleCodeBlock().run(),
  },
];
