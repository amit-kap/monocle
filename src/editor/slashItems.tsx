import type { Editor, Range } from "@tiptap/core";
import type { ReactNode } from "react";
import { nextFootnoteLabel } from "./extensions/Footnotes";
import { BlockTypeIcon, FootnoteIcon, ImageIcon, TableIcon } from "../components/blockIcons";

export type SlashItem = {
  title: string;
  keywords: string[];
  icon: ReactNode;
  run: (editor: Editor, range: Range) => void;
};


function chain(editor: Editor, range: Range) {
  return editor.chain().focus().deleteRange(range);
}

// The editor pane registers how an image file is picked and saved beside the
// note, since that needs the open note's path.
let pickImage: ((editor: Editor) => void) | null = null;
export function setImagePicker(fn: ((editor: Editor) => void) | null): void {
  pickImage = fn;
}

/** A footnote marker at the caret, its definition at the end, and the caret in it. */
export function insertFootnote(editor: Editor): void {
  const label = nextFootnoteLabel(editor.state.doc);
  editor.chain().focus().insertContent({ type: "footnoteRef", attrs: { label } }).run();
  const end = editor.state.doc.content.size;
  editor
    .chain()
    .insertContentAt(end, {
      type: "footnoteDef",
      attrs: { label },
      content: [{ type: "paragraph" }],
    })
    .run();
  // The caret goes into the definition's empty paragraph.
  let target = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnoteDef" && node.attrs.label === label) target = pos + 2;
  });
  if (target > 0) editor.chain().setTextSelection(target).scrollIntoView().run();
}

const heading = (level: 1 | 2 | 3 | 4 | 5 | 6): SlashItem => ({
  title: `Heading ${level}`,
  keywords: [`h${level}`, "heading", "title"],
  icon: <BlockTypeIcon kind={level} />,
  run: (editor, range) => chain(editor, range).setNode("heading", { level }).run(),
});

export const slashItems: SlashItem[] = [
  {
    title: "Text",
    keywords: ["text", "paragraph", "plain", "p"],
    icon: <BlockTypeIcon kind="paragraph" />,
    run: (editor, range) => chain(editor, range).setParagraph().run(),
  },
  heading(1),
  heading(2),
  heading(3),
  heading(4),
  heading(5),
  heading(6),
  {
    title: "Bullet list",
    keywords: ["bullet", "list", "ul", "unordered"],
    icon: <BlockTypeIcon kind="bulletList" />,
    run: (editor, range) => chain(editor, range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    keywords: ["numbered", "ordered", "list", "ol", "1."],
    icon: <BlockTypeIcon kind="orderedList" />,
    run: (editor, range) => chain(editor, range).toggleOrderedList().run(),
  },
  {
    title: "Task list",
    keywords: ["todo", "task", "checkbox", "check", "list"],
    icon: <BlockTypeIcon kind="taskList" />,
    run: (editor, range) => chain(editor, range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    keywords: ["quote", "blockquote", "citation"],
    icon: <BlockTypeIcon kind="blockquote" />,
    run: (editor, range) => chain(editor, range).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    keywords: ["code", "pre", "snippet", "mono", "fence"],
    icon: <BlockTypeIcon kind="codeBlock" />,
    run: (editor, range) => chain(editor, range).toggleCodeBlock().run(),
  },
  {
    title: "Table",
    keywords: ["table", "grid", "rows", "columns"],
    icon: <TableIcon />,
    run: (editor, range) =>
      chain(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Image",
    keywords: ["image", "picture", "photo", "img"],
    icon: <ImageIcon />,
    run: (editor, range) => {
      chain(editor, range).run();
      pickImage?.(editor);
    },
  },
  {
    title: "Divider",
    keywords: ["divider", "rule", "hr", "line", "separator"],
    icon: <BlockTypeIcon kind="divider" />,
    run: (editor, range) => chain(editor, range).setHorizontalRule().run(),
  },
  {
    title: "Footnote",
    keywords: ["footnote", "note", "reference", "cite"],
    icon: <FootnoteIcon />,
    run: (editor, range) => {
      chain(editor, range).run();
      insertFootnote(editor);
    },
  },
];
