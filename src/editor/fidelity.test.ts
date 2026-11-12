import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { toMarkdown } from "../lib/markdown";
import { composeNote, loadNote } from "../lib/compose";
import { diffLines, diffStats } from "../lib/diff";
import { makeTestEditor } from "./testEditor";

// The spec's fidelity tests, run on realistic agent files.
//
//   Test A: open a file and close it without editing. It must be byte-identical.
//   Test B: change one word. The diff against the file must touch only that line.

const FILES = ["CLAUDE.md", "AGENTS.md", "SKILL.md"];
const fixtures = import.meta.glob<string>("./fixtures/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const read = (name: string): string => {
  const text = fixtures[`./fixtures/${name}`];
  if (text === undefined) throw new Error(`missing fixture ${name}`);
  return text;
};

function open(text: string) {
  const editor = makeTestEditor();
  const note = loadNote(text, (body) => {
    editor.commands.setContent(body, { emitUpdate: false });
    return toMarkdown(editor);
  });
  return { editor, note };
}

/** Replace the first occurrence of `from` in the document's text with `to`. */
function replaceWord(editor: Editor, from: string, to: string): void {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return;
    const at = node.text?.indexOf(from) ?? -1;
    if (at >= 0) found = pos + at;
  });
  if (found < 0) throw new Error(`"${from}" not found in the document`);
  editor.chain().setTextSelection({ from: found, to: found + from.length }).insertContent(to).run();
}

describe("Test A: opening and closing never changes a file", () => {
  it.each(FILES)("%s comes back byte-identical", (name) => {
    const text = read(name);
    const { editor, note } = open(text);
    expect(composeNote(note, toMarkdown(editor))).toBe(text);
  });

  it("keeps CRLF line endings and a missing final newline", () => {
    const crlf = "# Title\r\n\r\nSome text.\r\n";
    const a = open(crlf);
    expect(composeNote(a.note, toMarkdown(a.editor))).toBe(crlf);

    const bare = "# Title\n\nno newline at the end";
    const b = open(bare);
    expect(composeNote(b.note, toMarkdown(b.editor))).toBe(bare);
  });
});

describe("Test B: changing one word touches only that line", () => {
  const EDITS: [string, string, string][] = [
    ["CLAUDE.md", "pnpm", "npm"],
    ["CLAUDE.md", "Prefer", "Favour"],
    ["CLAUDE.md", "unit", "integration"],
    ["CLAUDE.md", "imperative", "present-tense"],
    ["AGENTS.md", "bullet one", "bullet uno"],
    ["AGENTS.md", "Second", "Middle"],
    ["AGENTS.md", "open task", "pending task"],
    ["SKILL.md", "Follow", "Obey"],
    ["SKILL.md", "templates", "forms"],
    ["SKILL.md", "Show", "Give"],
  ];

  it.each(EDITS)("%s: %s → %s", (name, from, to) => {
    const text = read(name);
    const { editor, note } = open(text);
    replaceWord(editor, from, to);
    const result = composeNote(note, toMarkdown(editor));

    const stats = diffStats(diffLines(text, result));
    expect(result).not.toBe(text);
    expect(result).toContain(to);
    // One line out, one line in: nothing else in the file moved.
    expect(stats).toEqual({ added: 1, removed: 1 });
  });

  it("leaves the frontmatter and raw HTML exactly as written", () => {
    const text = read("CLAUDE.md");
    const { editor, note } = open(text);
    replaceWord(editor, "pnpm", "yarn");
    const result = composeNote(note, toMarkdown(editor));
    expect(result.startsWith(text.slice(0, text.indexOf("# Mod Studio")))).toBe(true);
    expect(result).toContain("<details>\n<summary>Release notes</summary>");
    expect(result).toContain("___");
    expect(result).toContain("* Keep changes small");
    expect(result).toContain("1) Run `pnpm test`");
  });
});
