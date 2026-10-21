import { describe, expect, it } from "vitest";
import { makeTestEditor, onDisk } from "./testEditor";
import { toMarkdown } from "../lib/markdown";
import { LANGUAGES, languageOptions } from "../lib/languages";
import { lowlight } from "./extensions/CodeBlock";

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

describe("the languages the picker offers", () => {
  const grammars = lowlight.listLanguages();

  it("names every grammar the editor can highlight", () => {
    const options = languageOptions(grammars);
    for (const grammar of grammars) {
      const found = options.find((option) => option.value === grammar);
      expect(found, grammar).toBeDefined();
      // An entry missing from LANGUAGES falls back to the bare grammar name.
      expect(found?.label, grammar).not.toBe(grammar);
    }
  });

  it("names nothing lowlight cannot highlight", () => {
    const known = new Set(grammars);
    for (const key of Object.keys(LANGUAGES)) expect(known.has(key), key).toBe(true);
    for (const option of languageOptions(grammars)) {
      expect(known.has(option.value), option.label).toBe(true);
    }
  });
});
