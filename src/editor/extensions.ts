import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { MarkdownTable } from "./extensions/MarkdownTable";
import { CodeBlock } from "./extensions/CodeBlock";
import { LocalImages } from "./extensions/LocalImages";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { SlashCommand } from "./extensions/SlashCommand";
import { SoftBreakSpace } from "./extensions/SoftBreakSpace";
import { TaskListTight } from "./extensions/TaskListTight";

// The one extension stack the app ships with, shared by the editor pane and
// the round-trip fixtures so the tests cannot drift from what runs.
export const appExtensions = [
  StarterKit.configure({
    // Markdown has no underline syntax and tiptap-markdown has no underline
    // mark spec, so the serializer drops the mark and glues the surrounding
    // words together: "p<u>under</u>lain" saves as "punderlain". Leaving the
    // mark out keeps ⌘U from silently eating text.
    underline: false,
    // Replaced below by the lowlight-backed version.
    codeBlock: false,
  }),
  // Without this, `![alt](img.png)` is dropped from the document on load and
  // the image is gone from the file on the next save. Relative paths don't
  // resolve to anything in the webview yet, so these render as placeholders —
  // but the markdown survives, which is the point for now.
  Image.configure({ inline: true, allowBase64: true }),
  // Without these, a markdown table is parsed as loose text and rewritten as
  // the paragraph "ab" on the next save, destroying the table.
  MarkdownTable,
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder: "Write something…" }),
  Markdown.configure({
    html: false,
    tightLists: true,
    linkify: false,
    breaks: false,
  }),
  SoftBreakSpace,
  TaskListTight,
  CodeBlock,
  LocalImages,
  SlashCommand,
];