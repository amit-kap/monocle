import { describe, expect, it } from "vitest";
import { makeTestEditor, onDisk } from "./testEditor";
import { toMarkdown } from "../lib/markdown";
import { resolveLanguage } from "./extensions/CodeBlock";

function highlight(markdown: string) {
  const editor = makeTestEditor(markdown);
  const code = editor.view.dom.querySelector("pre code");
  const spans = [...(code?.querySelectorAll("span") ?? [])].map((s) => s.className);
  editor.destroy();
  return spans;
}

describe("code highlighting", () => {
  it("wraps tokens in highlight.js classes", () => {
    const spans = highlight(
      ["```ts", "const x: number = 1;", "```"].join("\n"),
    );
    expect(spans.length).toBeGreaterThan(0);
  });

  it("highlights comments as comments", () => {
    const spans = highlight(["```js", "// a note", "```"].join("\n"));
    expect(spans.some((c) => c.includes("hljs-comment"))).toBe(true);
  });

  it("highlights keywords", () => {
    const spans = highlight(["```js", "const x = 1;", "```"].join("\n"));
    expect(spans.some((c) => c.includes("hljs-keyword"))).toBe(true);
  });

  it("highlights strings", () => {
    const spans = highlight(["```js", 'const s = "hi";', "```"].join("\n"));
    expect(spans.some((c) => c.includes("hljs-string"))).toBe(true);
  });

  it("falls back to auto-detection when the fence names no language", () => {
    // lowlight guesses rather than leaving the block plain, which is the
    // extension's behaviour; the point is that it does not error.
    const spans = highlight(["```", "const x = 1;", "```"].join("\n"));
    expect(spans.length).toBeGreaterThan(0);
  });

  it("does not break on a language it does not know", () => {
    const editor = makeTestEditor(["```nosuchlang", "stuff", "```"].join("\n"));
    expect(toMarkdown(editor)).toBe(onDisk("```nosuchlang\nstuff\n```"));
    editor.destroy();
  });

  it("keeps the language on the fence through a save", () => {
    const editor = makeTestEditor(["```ts", "const x = 1;", "```"].join("\n"));
    expect(toMarkdown(editor)).toBe(onDisk("```ts\nconst x = 1;\n```"));
    editor.destroy();
  });

  it("keeps the language when it is spelled out", () => {
    const editor = makeTestEditor(
      ["```typescript", "const x = 1;", "```"].join("\n"),
    );
    expect(toMarkdown(editor)).toBe(onDisk("```typescript\nconst x = 1;\n```"));
    editor.destroy();
  });

  it("does not highlight inside inline code", () => {
    const editor = makeTestEditor("some `const x = 1;` inline\n");
    const inline = editor.view.dom.querySelector("p code");
    expect(inline?.querySelectorAll("span").length ?? 0).toBe(0);
    editor.destroy();
  });
});

describe("resolveLanguage", () => {
  it.each([
    ["ts", "typescript"],
    ["tsx", "typescript"],
    ["js", "javascript"],
    ["jsx", "javascript"],
    ["sh", "bash"],
    ["zsh", "bash"],
    ["py", "python"],
    ["yml", "yaml"],
    ["md", "markdown"],
    ["rb", "ruby"],
    ["rs", "rust"],
    ["plaintext", "plaintext"],
  ])("maps %s to %s", (tag, expected) => {
    expect(resolveLanguage(tag)).toBe(expected);
  });

  it("passes a full language name through", () => {
    expect(resolveLanguage("typescript")).toBe("typescript");
    expect(resolveLanguage("python")).toBe("python");
  });

  it("is case insensitive", () => {
    expect(resolveLanguage("TS")).toBe("typescript");
  });

  it.each([["nope"], [""], ["   "], [null], [undefined]])(
    "returns null for %s",
    (tag) => {
      expect(resolveLanguage(tag as string | null | undefined)).toBeNull();
    },
  );
});