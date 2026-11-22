import { describe, expect, it } from "vitest";
import { toMarkdown } from "../lib/markdown";
import { makeTestEditor } from "./testEditor";

// Every GitHub markdown element, plus footnotes, must come back as written
// (or as its one canonical spelling) and stay put on a second save.
const SAME: Record<string, string> = {
  "headings 1-6": "# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6",
  "inline marks": "*i* **b** ~~s~~ `c` ***bi***",
  "hard break": "line one\\\nline two",
  link: "[text](https://a.com \"Title\")",
  autolink: "<https://a.com>",
  image: "![alt](img.png \"t\")",
  "linked image": "[![alt](img.png)](https://a.com)",
  "nested quote": "> outer\n>\n> > inner",
  "nested lists": "1. a\n   - [ ] t\n   - b\n2. c",
  "task list": "- [ ] a\n- [x] b\n  - [ ] c",
  "fenced code": "```js\nconst a = 1;\n```",
  rule: "a\n\n---\n\nb",
  "aligned table": "| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |",
  footnote: "Text[^1] and more[^note].\n\n[^1]: The note.\n\n[^note]: A named note.",
  "multi-paragraph footnote": "A[^1].\n\n[^1]: First.\n\n    Second paragraph.",
  "unused footnote definition": "Text.\n\n[^9]: Kept anyway.",
  "inline html": "Press <kbd>⌘</kbd> + <kbd>S</kbd>.",
  "html block": "<details>\n<summary>More</summary>\n\nHidden **text**.\n\n</details>",
  "html comment": "<!-- a note to agents -->",
  arrows: "a -> b, x < y, y > z",
  // Only the `<` needs its entity; the `>` is written bare.
  "literal tag text": "the &lt;div> tag",
};

describe("GitHub markdown round-trip", () => {
  it.each(Object.entries(SAME))("%s", (_name, md) => {
    const out = toMarkdown(makeTestEditor(md)).trimEnd();
    expect(out).toBe(md);
    expect(toMarkdown(makeTestEditor(out)).trimEnd()).toBe(out);
  });

  it("renders footnotes and raw HTML as their own nodes", () => {
    const editor = makeTestEditor("A[^1] <kbd>x</kbd>\n\n[^1]: Note.");
    const types = new Set<string>();
    editor.state.doc.descendants((n) => {
      types.add(n.type.name);
    });
    expect(types).toContain("footnoteRef");
    expect(types).toContain("footnoteDef");
    expect(types).toContain("rawHtmlInline");
  });
});
