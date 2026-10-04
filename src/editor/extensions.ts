import { StarterKit } from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { SlashCommand } from "./extensions/SlashCommand";
import { SoftBreakSpace } from "./extensions/SoftBreakSpace";

// The one extension stack the app ships with, shared by the editor pane and
// the round-trip fixtures so the tests cannot drift from what runs.
export const appExtensions = [
  StarterKit.configure({
    // Markdown has no underline syntax and tiptap-markdown has no underline
    // mark spec, so the serializer drops the mark and glues the surrounding
    // words together: "p<u>under</u>lain" saves as "punderlain". Leaving the
    // mark out keeps ⌘U from silently eating text.
    underline: false,
  }),
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
  SlashCommand,
];