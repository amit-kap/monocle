import { describe, expect, it } from "vitest";
import { makeTestEditor } from "../editor/testEditor";
import { toMarkdown } from "./markdown";

describe("toMarkdown", () => {
  it("ends a note with a trailing newline", () => {
    // git and POSIX both treat a missing trailing newline as a change to the
    // last line, so without this every save produces a spurious diff.
    expect(toMarkdown(makeTestEditor("hello"))).toBe("hello\n");
  });

  it("does not double the newline", () => {
    const editor = makeTestEditor("hello");
    const once = toMarkdown(editor);
    expect(toMarkdown(editor)).toBe(once);
    expect(once.endsWith("\n\n")).toBe(false);
    editor.destroy();
  });

  it("leaves an empty note empty", () => {
    expect(toMarkdown(makeTestEditor(""))).toBe("");
  });

  it("keeps internal blank lines intact", () => {
    expect(toMarkdown(makeTestEditor("one\n\ntwo"))).toBe("one\n\ntwo\n");
  });

  it("survives a save/load cycle without growing", () => {
    const editor = makeTestEditor("hello");
    const first = toMarkdown(editor);
    const reopened = makeTestEditor(first);
    expect(toMarkdown(reopened)).toBe(first);
    editor.destroy();
    reopened.destroy();
  });
});