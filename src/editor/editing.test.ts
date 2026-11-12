import { describe, expect, it } from "vitest";
import { toMarkdown } from "../lib/markdown";
import { slashItems } from "./slashItems";
import { makeTestEditor } from "./testEditor";

// Every block in the spec's 5.7 can be made, written to markdown, and read back.

function run(title: string, editor: ReturnType<typeof makeTestEditor>) {
  const item = slashItems.find((i) => i.title === title);
  if (!item) throw new Error(`no slash item "${title}"`);
  editor.commands.setContent("/");
  const end = editor.state.doc.content.size;
  item.run(editor, { from: 1, to: end - 1 });
}

describe("the block menu", () => {
  it("offers Table, Task list and Code block, and nothing else", () => {
    expect(slashItems.map((i) => i.title)).toEqual(["Table", "Task list", "Code block"]);
  });

  it("makes a table that survives a save and reopen", () => {
    const editor = makeTestEditor();
    run("Table", editor);
    const md = toMarkdown(editor);
    expect(md).toMatch(/^\|.*\|\n\|[-| :]+\|\n/);
    const again = makeTestEditor(md);
    expect(toMarkdown(again)).toBe(md);
  });

  it("makes a task list that survives a save and reopen", () => {
    const editor = makeTestEditor();
    run("Task list", editor);
    // An empty task has no text for the parser to hold on to, so write some.
    editor.commands.insertContent("write the plan");
    const md = toMarkdown(editor);
    expect(md).toMatch(/^- \[ \] write the plan/);
    expect(toMarkdown(makeTestEditor(md))).toBe(md);
  });

  it("makes a code block that survives a save and reopen", () => {
    const editor = makeTestEditor();
    run("Code block", editor);
    editor.commands.insertContent("pnpm test");
    const md = toMarkdown(editor);
    expect(md).toContain("```");
    expect(md).toContain("pnpm test");
    expect(toMarkdown(makeTestEditor(md))).toBe(md);
  });
});

describe("formatting a selection", () => {
  function select(editor: ReturnType<typeof makeTestEditor>, word: string) {
    let from = -1;
    editor.state.doc.descendants((node, pos) => {
      if (from < 0 && node.isText && node.text?.includes(word)) from = pos + node.text.indexOf(word);
    });
    editor.commands.setTextSelection({ from, to: from + word.length });
  }

  it.each([
    ["toggleBold", "**word**"],
    ["toggleItalic", "*word*"],
    ["toggleStrike", "~~word~~"],
    ["toggleCode", "`word`"],
  ] as const)("%s writes %s", (command, expected) => {
    const editor = makeTestEditor("a word here");
    select(editor, "word");
    (editor.commands as unknown as Record<string, () => boolean>)[command]();
    expect(toMarkdown(editor)).toContain(expected);
  });

  it("links a selection", () => {
    const editor = makeTestEditor("a word here");
    select(editor, "word");
    editor.chain().setLink({ href: "https://example.com" }).run();
    expect(toMarkdown(editor)).toContain("[word](https://example.com)");
  });
});

describe("markdown shortcuts keep their syntax on disk", () => {
  it.each([
    ["## Heading", "## Heading"],
    ["- item", "- item"],
    ["1. item", "1. item"],
    ["- [ ] task", "- [ ] task"],
    ["> quote", "> quote"],
    ["---", "---"],
  ])("%s", (input, expected) => {
    expect(toMarkdown(makeTestEditor(input)).trim()).toBe(expected);
  });
});
