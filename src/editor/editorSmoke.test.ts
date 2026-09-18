import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { SlashCommand } from "./extensions/SlashCommand";
import { toMarkdown } from "../lib/markdown";

function makeEditor(content = ""): Editor {
  return new Editor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Write something…" }),
      Markdown.configure({
        html: false,
        tightLists: true,
        linkify: false,
        breaks: false,
      }),
      SlashCommand,
    ],
    content,
  });
}

describe("editor setup", () => {
  it("creates an editor with all extensions", () => {
    const editor = makeEditor("# Hello");
    expect(editor.getHTML()).toContain("Hello");
    editor.destroy();
  });

  it("round-trips markdown", () => {
    const md = [
      "# Title",
      "",
      "Some **bold** and _italic_ text.",
      "",
      "- one",
      "- two",
      "",
      "> quote",
      "",
      "```",
      "const x = 1;",
      "```",
      "",
    ].join("\n");

    const editor = makeEditor(md);
    const output = toMarkdown(editor);
    expect(output).toContain("# Title");
    expect(output).toContain("**bold**");
    expect(output).toContain("- one");
    expect(output).toContain("> quote");
    expect(output).toContain("const x = 1;");
    editor.destroy();
  });
});
