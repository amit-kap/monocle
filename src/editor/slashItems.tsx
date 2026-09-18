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

export const slashItems: SlashItem[] = [
  {
    title: "Text",
    keywords: ["paragraph", "plain", "body"],
    icon: <Glyph>T</Glyph>,
    run: (editor, range) => chain(editor, range).setParagraph().run(),
  },
  {
    title: "Heading 1",
    keywords: ["h1", "title", "large"],
    icon: <Glyph>H1</Glyph>,
    run: (editor, range) =>
      chain(editor, range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    keywords: ["h2", "subtitle"],
    icon: <Glyph>H2</Glyph>,
    run: (editor, range) =>
      chain(editor, range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    keywords: ["h3", "subtitle", "small"],
    icon: <Glyph>H3</Glyph>,
    run: (editor, range) =>
      chain(editor, range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet List",
    keywords: ["unordered", "ul", "bullet", "list"],
    icon: <Glyph>•</Glyph>,
    run: (editor, range) => chain(editor, range).toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    keywords: ["ordered", "ol", "number", "list"],
    icon: <Glyph>1.</Glyph>,
    run: (editor, range) => chain(editor, range).toggleOrderedList().run(),
  },
  {
    title: "To-do List",
    keywords: ["todo", "task", "checkbox", "check", "list"],
    icon: <Glyph>☐</Glyph>,
    run: (editor, range) => chain(editor, range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    keywords: ["blockquote", "citation", "quote"],
    icon: <Glyph>❝</Glyph>,
    run: (editor, range) => chain(editor, range).toggleBlockquote().run(),
  },
  {
    title: "Code Block",
    keywords: ["code", "pre", "snippet", "mono"],
    icon: <Glyph>{"</>"}</Glyph>,
    run: (editor, range) => chain(editor, range).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    keywords: ["hr", "line", "separator", "rule"],
    icon: <Glyph>—</Glyph>,
    run: (editor, range) => chain(editor, range).setHorizontalRule().run(),
  },
];
