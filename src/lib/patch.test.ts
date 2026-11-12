import { describe, expect, it } from "vitest";
import { patchOriginal } from "./patch";

describe("patchOriginal", () => {
  it("returns the original when nothing changed", () => {
    expect(patchOriginal("* a\n* b\n", "- a\n- b\n", "- a\n- b\n")).toBe("* a\n* b\n");
  });

  it("changes only the edited line, keeping other markers as written", () => {
    const original = "# T\n\n* one\n* two\n* three\n";
    const baseline = "# T\n\n- one\n- two\n- three\n";
    const edited = "# T\n\n- one\n- TWO\n- three\n";
    expect(patchOriginal(original, baseline, edited)).toBe("# T\n\n* one\n- TWO\n* three\n");
  });

  it("keeps a wrapped paragraph wrapped when one word changes", () => {
    const original = "Use pnpm for everything.  Run the dev\nserver before touching UI code.\n";
    const baseline = "Use pnpm for everything. Run the dev server before touching UI code.\n";
    const edited = "Use npm for everything. Run the dev server before touching UI code.\n";
    expect(patchOriginal(original, baseline, edited)).toBe(
      "Use npm for everything.  Run the dev\nserver before touching UI code.\n",
    );
  });

  it("inserts a new paragraph without touching its neighbours", () => {
    const original = "A\n\nB\n";
    const result = patchOriginal(original, "A\n\nB\n", "A\n\nNew\n\nB\n");
    expect(result).toBe("A\n\nNew\n\nB\n");
  });

  it("appends a word without leaving a trailing space", () => {
    expect(patchOriginal("hello world\n", "hello world\n", "hello world again\n")).toBe(
      "hello world again\n",
    );
  });

  it("removes a paragraph", () => {
    expect(patchOriginal("A\n\nB\n\nC\n", "A\n\nB\n\nC\n", "A\n\nC\n")).toBe("A\n\nC\n");
  });

  it("keeps CRLF line endings", () => {
    expect(patchOriginal("a\r\n\r\nb\r\n", "a\n\nb\n", "a\n\nB\n")).toBe("a\r\n\r\nB\r\n");
  });

  it("does not add a trailing newline the file did not have", () => {
    expect(patchOriginal("a\n\nb", "a\n\nb\n", "a\n\nB\n")).toBe("a\n\nB");
  });

  it("takes the editor's text for a file that was empty", () => {
    expect(patchOriginal("", "", "hello\n")).toBe("hello\n");
  });

  it("can empty a file", () => {
    expect(patchOriginal("a\n", "a\n", "")).toBe("");
  });
});
