import { describe, expect, it } from "vitest";
import { toMarkdown } from "../lib/markdown";
import { makeTestEditor } from "./testEditor";

// Each fixture pins two things:
//
//   1. Exact output. `input` is markdown as a user would type it; `expected`
//      is what Monocle must write back to disk. Serializers drop the trailing
//      newline, so expectations have none.
//   2. Idempotency. Re-parsing the output must produce an identical document,
//      so saving a note twice never keeps churning the file.
//
// `expected` doubles as the assertion that no content was silently dropped:
// these strings are the whole document.
const FIXTURES: Array<{ name: string; input: string; expected: string }> = [
  // Headings
  { name: "h1", input: "# H1\n", expected: "# H1" },
  { name: "h2", input: "## H2\n", expected: "## H2" },
  { name: "h3", input: "### H3\n", expected: "### H3" },
  {
    name: "all heading levels",
    input: "# One\n\n## Two\n\n### Three\n",
    expected: "# One\n\n## Two\n\n### Three",
  },

  // Paragraphs
  { name: "single paragraph", input: "hello\n", expected: "hello" },
  { name: "two paragraphs", input: "one\n\ntwo\n", expected: "one\n\ntwo" },

  // Inline marks
  {
    name: "bold and italic",
    input: "Some **bold** and *italic* text.\n",
    expected: "Some **bold** and *italic* text.",
  },
  {
    name: "bold italic combined",
    input: "***both***\n",
    expected: "***both***",
  },
  { name: "strikethrough", input: "~~gone~~\n", expected: "~~gone~~" },
  { name: "inline code", input: "call `fn()` now\n", expected: "call `fn()` now" },

  // Lists
  {
    name: "bullet list",
    input: "- one\n- two\n- three\n",
    expected: "- one\n- two\n- three",
  },
  { name: "ordered list", input: "1. one\n2. two\n", expected: "1. one\n2. two" },
  {
    name: "nested bullet list",
    input: "- one\n  - one a\n  - one b\n- two\n",
    expected: "- one\n  - one a\n  - one b\n- two",
  },
  {
    name: "mixed nested list",
    input: "- top\n  1. first\n  2. second\n- bottom\n",
    expected: "- top\n  1. first\n  2. second\n- bottom",
  },
  { name: "loose bullet list", input: "- one\n\n- two\n", expected: "- one\n\n- two" },

  // Task lists
  {
    name: "task list",
    input: "- [ ] todo\n- [x] done\n",
    expected: "- [ ] todo\n- [x] done",
  },
  {
    name: "nested task list",
    input: "- [ ] parent\n  - [x] child\n",
    expected: "- [ ] parent\n  - [x] child",
  },
  {
    // An author who wrote blank lines between tasks meant them; stay loose.
    name: "loose task list stays loose",
    input: "- [ ] todo\n\n- [x] done\n",
    expected: "- [ ] todo\n\n- [x] done",
  },

  // Quotes
  { name: "blockquote", input: "> quote\n", expected: "> quote" },
  {
    name: "blockquote wrapped over two lines",
    input: "> line one\n> line two\n",
    expected: "> line one line two",
  },
  {
    name: "blockquote holding a list",
    input: "> - one\n> - two\n",
    expected: "> - one\n> - two",
  },

  // Code blocks
  {
    name: "code block without language",
    input: "```\nconst x = 1;\n```\n",
    expected: "```\nconst x = 1;\n```",
  },
  {
    name: "code block with language",
    input: "```ts\nconst x = 1;\n```\n",
    expected: "```ts\nconst x = 1;\n```",
  },
  {
    name: "code block language spelled out",
    input: "```typescript\nconst x: number = 1;\n```\n",
    expected: "```typescript\nconst x: number = 1;\n```",
  },
  {
    name: "code block holding markdown syntax",
    input: "```md\n# not a heading\n```\n",
    expected: "```md\n# not a heading\n```",
  },

  // Links
  {
    name: "link",
    input: "[label](https://example.com)\n",
    expected: "[label](https://example.com)",
  },
  {
    name: "link with title",
    input: '[label](https://example.com "Title")\n',
    expected: '[label](https://example.com "Title")',
  },
  { name: "autolink", input: "<https://example.com>\n", expected: "<https://example.com>" },
  {
    name: "bare url",
    input: "see https://example.com now\n",
    expected: "see https://example.com now",
  },
  { name: "link inside a sentence", input: "read [this](https://a.co) now\n", expected: "read [this](https://a.co) now" },

  // Dividers
  { name: "horizontal rule", input: "---\n", expected: "---" },

  // Tables
  {
    name: "table",
    input: "| a | b |\n| --- | --- |\n| 1 | 2 |\n",
    expected: "| a | b |\n| --- | --- |\n| 1 | 2 |\n",
  },
  {
    name: "table with three rows",
    input: "| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |\n",
    expected: "| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |\n",
  },
  {
    name: "table with one column",
    input: "| a |\n| --- |\n| 1 |\n",
    expected: "| a |\n| --- |\n| 1 |\n",
  },
  {
    // Alignment was parsed but never written back, so the first save flattened
    // every column to `---`.
    name: "table with column alignment",
    input: "| a | b | c |\n| :--- | ---: | :---: |\n| 1 | 2 | 3 |\n",
    expected: "| a | b | c |\n| :--- | ---: | :---: |\n| 1 | 2 | 3 |\n",
  },
  {
    name: "table with empty cells",
    input: "| a | b |\n| --- | --- |\n|  |  |\n",
    expected: "| a | b |\n| --- | --- |\n|  |  |\n",
  },
  {
    name: "table with marks in cells",
    input: "| a | b |\n| --- | --- |\n| **x** | `y` |\n",
    expected: "| a | b |\n| --- | --- |\n| **x** | `y` |\n",
  },
  {
    name: "table with a link in a cell",
    input: "| a |\n| --- |\n| [l](https://a.co) |\n",
    expected: "| a |\n| --- |\n| [l](https://a.co) |\n",
  },
  {
    // A bare pipe used to split one cell into two and reshape the table.
    name: "table cell containing a pipe",
    input: "| a |\n| --- |\n| x \\| y |\n",
    expected: "| a |\n| --- |\n| x \\| y |\n",
  },
  {
    name: "two tables separated by a blank line",
    input: "| a |\n| --- |\n| 1 |\n\n| b |\n| --- |\n| 2 |\n",
    expected: "| a |\n| --- |\n| 1 |\n\n| b |\n| --- |\n| 2 |\n",
  },
  {
    name: "table in a quote",
    input: "> | a |\n> | --- |\n> | 1 |\n",
    expected: "> | a |\n> | --- |\n> | 1 |\n",
  },
  {
    name: "table between paragraphs",
    input: "before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter\n",
    expected: "before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter",
  },

  // Images. Markdown allows an image anywhere in a sentence, so these are the
  // cases that used to either delete the image or weld it to neighbouring text.
  {
    name: "image alone",
    input: "![alt](img.png)\n",
    expected: "![alt](img.png)",
  },
  {
    name: "image in a subfolder",
    input: "![alt](assets/img.png)\n",
    expected: "![alt](assets/img.png)",
  },
  {
    name: "image with an absolute path",
    input: "![alt](/Users/me/img.png)\n",
    expected: "![alt](/Users/me/img.png)",
  },
  {
    name: "image with a title",
    input: '![alt](img.png "The title")\n',
    expected: '![alt](img.png "The title")',
  },
  { name: "image with no alt text", input: "![](img.png)\n", expected: "![](img.png)" },
  {
    name: "image from a url",
    input: "![alt](https://example.com/a.png)\n",
    expected: "![alt](https://example.com/a.png)",
  },
  {
    name: "image as a data uri",
    input: "![alt](data:image/png;base64,iVBORw0KGgo=)\n",
    expected: "![alt](data:image/png;base64,iVBORw0KGgo=)",
  },
  {
    name: "percent-encoded image path",
    input: "![alt](my%20image.png)\n",
    expected: "![alt](my%20image.png)",
  },
  {
    name: "image mid-sentence",
    input: "text ![alt](img.png) more\n",
    expected: "text ![alt](img.png) more",
  },
  {
    name: "two images",
    input: "![a](1.png)\n\n![b](2.png)\n",
    expected: "![a](1.png)\n\n![b](2.png)",
  },
  {
    name: "image in a list item",
    input: "- ![alt](img.png)\n",
    expected: "- ![alt](img.png)",
  },
  {
    name: "image in a quote",
    input: "> ![alt](img.png)\n",
    expected: "> ![alt](img.png)",
  },
  {
    name: "image path containing parentheses",
    input: "![alt](a(1).png)\n",
    expected: "![alt](a\\(1\\).png)",
  },
  {
    // An unescaped space is not a valid image path, so markdown-it is right to
    // leave this as literal text. Pinned so it stays literal text.
    name: "image path with a raw space stays literal",
    input: "![alt](my image.png)\n",
    expected: "!\\[alt\\](my image.png)",
  },

  // Line breaks
  { name: "hard break", input: "one  \ntwo\n", expected: "one\\\ntwo" },
  {
    name: "soft break between plain words",
    input: "line one\nline two\n",
    expected: "line one line two",
  },
  // The two cases tiptap-markdown used to mangle: a soft break whose text
  // ends in an inline element had its only separating whitespace deleted.
  {
    name: "soft break after bold",
    input: "Some **bold**\nnext line",
    expected: "Some **bold** next line",
  },
  {
    name: "soft break after italic",
    input: "Some *em*\nnext line",
    expected: "Some *em* next line",
  },
  {
    name: "soft break after strikethrough",
    input: "Some ~~gone~~\nnext line",
    expected: "Some ~~gone~~ next line",
  },
  {
    name: "soft break after inline code",
    input: "Some `code`\nnext line",
    expected: "Some `code` next line",
  },
  {
    name: "soft break after link",
    input: "Some [link](https://a.co)\nnext line",
    expected: "Some [link](https://a.co) next line",
  },
  {
    name: "soft break between two inline elements",
    input: "a **b** `c`\nd",
    expected: "a **b** `c` d",
  },
  {
    name: "writer-style wrap around an inline element",
    input: "wrapped words here\n**bolded words**\nmore wrapped words",
    expected: "wrapped words here **bolded words** more wrapped words",
  },

  // Escapes
  {
    name: "escaped markdown punctuation",
    input: "a \\* b \\_ c \\[ d\n",
    expected: "a \\* b \\_ c \\[ d",
  },

  // Whitespace normalisation
  { name: "runs of spaces collapse", input: "a  b   c\n", expected: "a b c" },
  { name: "blank lines collapse to one", input: "a\n\n\n\nb\n", expected: "a\n\nb" },

  // Whole documents
  {
    name: "kitchen sink",
    input: [
      "# Notes",
      "",
      "Intro with **bold**, *italic*, `code`, and a [link](https://a.co).",
      "",
      "## Lists",
      "",
      "- alpha",
      "  - alpha one",
      "- beta",
      "",
      "1. first",
      "2. second",
      "",
      "- [ ] open task",
      "- [x] closed task",
      "",
      "> A quote that is",
      "> long enough to wrap",
      "",
      "```ts",
      "const answer = 42;",
      "```",
      "",
      "---",
      "",
      "The end.",
      "",
    ].join("\n"),
    expected: [
      "# Notes",
      "",
      "Intro with **bold**, *italic*, `code`, and a [link](https://a.co).",
      "",
      "## Lists",
      "",
      "- alpha",
      "  - alpha one",
      "- beta",
      "",
      "1. first",
      "2. second",
      "",
      "- [ ] open task",
      "- [x] closed task",
      "",
      "> A quote that is long enough to wrap",
      "",
      "```ts",
      "const answer = 42;",
      "```",
      "",
      "---",
      "",
      "The end.",
    ].join("\n"),
  },
];

describe("markdown round-trip fixtures", () => {
  it.each(FIXTURES)("$name", ({ input, expected }) => {
    const editor = makeTestEditor(input);
    expect(toMarkdown(editor)).toBe(expected);
    editor.destroy();
  });

  it.each(FIXTURES)("$name is idempotent", ({ expected }) => {
    // Saving an already-saved note must not change the file again, and the
    // document itself must be structurally identical.
    const editor = makeTestEditor(expected);
    expect(toMarkdown(editor)).toBe(expected);
    editor.destroy();
  });
});

describe("markdown round-trip keeps every word", () => {
  it.each(FIXTURES)("$name", ({ input, expected }) => {
    // The invariant behind the welded-text bugs: the words a reader sees must
    // be identical before and after a save. Comparing rendered text rather
    // than markdown means this catches a mark or node whose serializer is
    // missing, since that drops content outright.
    const visibleText = (md: string) => {
      const editor = makeTestEditor(md);
      const text = editor.state.doc.textContent;
      editor.destroy();
      return text.replace(/\s+/g, " ").trim();
    };

    expect(visibleText(expected)).toBe(visibleText(input));
  });
});

// Current behaviour, pinned so a future change is deliberate rather than
// accidental. These are the loose ends the markdown-component audit has to
// resolve; each is lossy or noisy, none is silently destructive.
describe("known round-trip gaps", () => {
  it("escapes raw HTML instead of parsing it, including <u>", () => {
    const editor = makeTestEditor("<div>block</div>\n");
    expect(toMarkdown(editor)).toBe("&lt;div&gt;block&lt;/div&gt;");
    editor.destroy();

    // The underline mark is switched off in appExtensions precisely because
    // it cannot survive a save; if this ever starts passing, the mark has been
    // re-enabled and needs a serializer.
    const underlined = makeTestEditor("<u>under</u>\n");
    expect(toMarkdown(underlined)).toBe("&lt;u&gt;under&lt;/u&gt;");
    underlined.destroy();
  });

  it("keeps a task list tight, so saves do not churn the file", () => {
    const editor = makeTestEditor("- [ ] a\n- [x] b\n");
    expect(toMarkdown(editor)).toBe("- [ ] a\n- [x] b");
    expect(editor.getAttributes("taskList").tight).toBe(true);
    editor.destroy();
  });
});

describe("every mark survives a save", () => {
  // A mark with no serializer spec is dropped *and* takes the whitespace
  // around it with it, welding neighbouring words together. Underline used to
  // do exactly this ("p<u>under</u>lain" saved as "punderlain"), so check each
  // mark the editor can apply: the word must come back, spaced, still marked.
  const marks = [
    { name: "bold", attrs: {}, syntax: (t: string) => `**${t}**` },
    { name: "italic", attrs: {}, syntax: (t: string) => `*${t}*` },
    { name: "strike", attrs: {}, syntax: (t: string) => `~~${t}~~` },
    { name: "code", attrs: {}, syntax: (t: string) => `\`${t}\`` },
    {
      name: "link",
      attrs: { href: "https://a.co" },
      syntax: (t: string) => `[${t}](https://a.co)`,
    },
  ];

  function markedDoc(mark: string, attrs: Record<string, unknown>) {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "before " },
            { type: "text", marks: [{ type: mark, attrs }], text: "marked" },
            { type: "text", text: " after" },
          ],
        },
      ],
    };
  }

  it.each(marks)("$name", ({ name, attrs, syntax }) => {
    const editor = makeTestEditor();
    editor.commands.setContent(markedDoc(name, attrs));
    expect(toMarkdown(editor)).toBe(`before ${syntax("marked")} after`);
    editor.destroy();
  });

  it.each(marks)("$name comes back marked after reopening", ({ name, attrs }) => {
    const editor = makeTestEditor();
    editor.commands.setContent(markedDoc(name, attrs));
    const markdown = toMarkdown(editor);
    editor.destroy();

    const reopened = makeTestEditor(markdown);
    // Spacing intact...
    expect(reopened.state.doc.textContent).toBe("before marked after");
    // ...and the mark is still on the word it was applied to.
    expect(JSON.stringify(reopened.getJSON())).toContain(`"${name}"`);
    reopened.destroy();
  });
});

describe("every block type survives a save", () => {
  // Same reasoning for nodes: a node with no serializer spec is not merely
  // restyled, it is deleted from the file.
  const blocks = [
    { name: "heading", doc: { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] }, expected: "## Title" },
    { name: "bulletList", doc: { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] }] }, expected: "- one" },
    { name: "blockquote", doc: { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "quoted" }] }] }, expected: "> quoted" },
    { name: "codeBlock", doc: { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const x = 1;" }] }, expected: "```ts\nconst x = 1;\n```" },
    { name: "horizontalRule", doc: { type: "horizontalRule" }, expected: "---" },
  ];

  it.each(blocks)("$name serializes to markdown", ({ doc, expected }) => {
    const editor = makeTestEditor();
    editor.commands.setContent({ type: "doc", content: [doc] });
    expect(toMarkdown(editor)).toBe(expected);
    editor.destroy();
  });

  it.each(blocks)("$name is still there after reopening", ({ doc, name }) => {
    const editor = makeTestEditor();
    editor.commands.setContent({ type: "doc", content: [doc] });
    const markdown = toMarkdown(editor);
    editor.destroy();

    const reopened = makeTestEditor(markdown);
    expect(reopened.state.doc.toJSON()).toEqual(
      expect.objectContaining({
        content: [expect.objectContaining({ type: name })],
      }),
    );
    reopened.destroy();
  });
});