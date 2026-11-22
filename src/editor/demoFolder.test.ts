import { describe, expect, it } from "vitest";
import { toMarkdown } from "../lib/markdown";
import { composeNote, loadNote } from "../lib/compose";
import { makeTestEditor } from "./testEditor";

// The demo folder Amit inspects by hand must also pass by machine: every note
// opens and closes byte-identical, and its editor serialisation is stable.
const files = import.meta.glob<string>("../../demo/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("demo folder", () => {
  it("has notes", () => expect(Object.keys(files).length).toBeGreaterThan(10));

  it.each(Object.entries(files))("%s", (_path, text) => {
    const editor = makeTestEditor();
    const note = loadNote(text, (body) => {
      editor.commands.setContent(body, { emitUpdate: false });
      return toMarkdown(editor);
    });
    expect(composeNote(note, toMarkdown(editor))).toBe(text);
    // A second pass changes nothing: saving twice never churns the file.
    const again = makeTestEditor(note.baseline);
    expect(toMarkdown(again)).toBe(note.baseline);
    // Nothing the author wrote is lost: every word is still there.
    const words = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
    // Entities decode (`&copy;` is ©) and reference links inline, by design.
    const source = note.body.replace(/&[a-z]+;/g, " ").replace(/\]\[[^\]]+\]|^\[[^\]^]+\]:.*$/gm, " ");
    const lost = words(source).filter((w) => !words(note.baseline).includes(w));
    expect(lost).toEqual([]);
  });
});
