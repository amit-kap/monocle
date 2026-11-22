import { describe, expect, it } from "vitest";
import { toMarkdown } from "../lib/markdown";
import { makeTestEditor } from "./testEditor";
import { alignColumn, appendToTable } from "./tableUtils";
import { insertFootnote, slashItems } from "./slashItems";
import { turnIntoBlock } from "./blockUtils";

const caretInText = (editor: ReturnType<typeof makeTestEditor>, text: string) => {
  let at = -1;
  editor.state.doc.descendants((n, p) => {
    if (at < 0 && n.isText && n.text?.includes(text)) at = p + n.text.indexOf(text);
  });
  editor.commands.setTextSelection(at);
};

describe("table actions", () => {
  it("aligns the caret's column, header included", () => {
    const e = makeTestEditor("| a | b |\n| --- | --- |\n| 1 | 2 |");
    caretInText(e, "2");
    alignColumn(e, "center");
    expect(toMarkdown(e).trimEnd()).toBe("| a | b |\n| --- | :---: |\n| 1 | 2 |");
  });

  it("adds and removes rows and columns", () => {
    const e = makeTestEditor("| a | b |\n| --- | --- |\n| 1 | 2 |");
    caretInText(e, "1");
    e.commands.addRowAfter();
    e.commands.addColumnAfter();
    expect(toMarkdown(e).trimEnd().split("\n")).toHaveLength(4);
    expect(toMarkdown(e).split("\n")[0].split("|").length - 2).toBe(3);
    e.commands.deleteRow();
    e.commands.deleteColumn();
    expect(toMarkdown(e).trimEnd().split("\n")).toHaveLength(3);
  });
});

describe("table edge strips", () => {
  it("add a row after the last row and a column after the last column", () => {
    const e = makeTestEditor("| a | b |\n| --- | --- |\n| 1 | 2 |");
    appendToTable(e, 0, "row");
    appendToTable(e, 0, "column");
    const lines = toMarkdown(e).trimEnd().split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0].split("|").length - 2).toBe(3);
  });
});

describe("footnotes", () => {
  it("inserts the next numbered marker and an empty definition", () => {
    const e = makeTestEditor("A[^1].\n\n[^1]: One.");
    caretInText(e, "A");
    e.commands.setTextSelection(2);
    insertFootnote(e);
    e.commands.insertContent("Two.");
    expect(toMarkdown(e).trimEnd()).toBe("A[^2][^1].\n\n[^1]: One.\n\n[^2]: Two.");
  });
});

describe("slash menu", () => {
  it("offers every block type", () => {
    const titles = slashItems.map((i) => i.title);
    for (const t of ["Text", "Heading 1", "Heading 6", "Bullet list", "Numbered list", "Task list",
      "Quote", "Code block", "Table", "Image", "Divider", "Footnote"]) {
      expect(titles).toContain(t);
    }
  });

  it.each([
    ["Heading 4", "#### x"],
    ["Bullet list", "- x"],
    ["Numbered list", "1. x"],
    ["Task list", "- [ ] x"],
    ["Quote", "> x"],
    ["Code block", "```\nx\n```"],
  ])("%s turns the line into %s", (title, expected) => {
    const e = makeTestEditor("x/");
    const item = slashItems.find((i) => i.title === title)!;
    item.run(e, { from: 2, to: 3 });
    expect(toMarkdown(e).trimEnd()).toBe(expected);
  });
});

describe("turn into code block", () => {
  it.each([
    ["a paragraph with marks", "A **bold** word.", "```\nA bold word.\n```"],
    ["a heading", "## Head", "```\nHead\n```"],
    ["a quote, unwrapping it", "> quoted", "```\nquoted\n```"],
  ])("%s", (_name, md, expected) => {
    const e = makeTestEditor(md);
    turnIntoBlock(e, 0, "codeBlock");
    expect(toMarkdown(e).trimEnd()).toBe(expected);
  });
});
