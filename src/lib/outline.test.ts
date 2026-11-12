import { describe, expect, it } from "vitest";
import {
  extractReferences,
  headingAtLine,
  isRelativeFile,
  parseHeadings,
  sectionText,
} from "./outline";
import { estimateTokens } from "./tokens";

const DOC = `---
description: x
# a comment in the yaml
---
# Guide

Intro text.

## Build

\`\`\`bash
# not a heading
pnpm dev
\`\`\`

### Detail

More.

## Test

Done.
`;

describe("parseHeadings", () => {
  const headings = parseHeadings(DOC);

  it("lists headings outside code and frontmatter", () => {
    expect(headings.map((h) => [h.level, h.title])).toEqual([
      [1, "Guide"],
      [2, "Build"],
      [3, "Detail"],
      [2, "Test"],
    ]);
  });

  it("numbers them from the top and records their lines", () => {
    expect(headings.map((h) => h.index)).toEqual([0, 1, 2, 3]);
    expect(DOC.split("\n")[headings[1].line]).toBe("## Build");
  });

  it("gives each section a token estimate, heading to the next heading", () => {
    const build = DOC.split("\n").slice(headings[1].line, headings[2].line).join("\n");
    expect(headings[1].tokens).toBe(estimateTokens(build));
    expect(headings.every((h) => h.tokens > 0)).toBe(true);
  });

  it("finds the heading a line sits under", () => {
    const line = DOC.split("\n").indexOf("pnpm dev");
    expect(headingAtLine(headings, line)?.title).toBe("Build");
    expect(headingAtLine(headings, 0)).toBeNull();
  });
});

describe("sectionText", () => {
  it("runs to the next heading of the same level or higher", () => {
    const headings = parseHeadings(DOC);
    const section = sectionText(DOC, headings, 1);
    expect(section.startsWith("## Build")).toBe(true);
    expect(section).toContain("### Detail");
    expect(section).toContain("More.");
    expect(section).not.toContain("## Test");
  });
});

describe("extractReferences", () => {
  const text = "# T\n\n## Rules\n\nSee [setup](docs/setup.md#x) and [site](https://a.com).\n\n![](a.png) and ![ok](b.png)\n\n`[no](code.md)`\n";
  const refs = extractReferences(text);

  it("finds links and images with their section", () => {
    expect(refs.map((r) => [r.kind, r.target, r.section])).toEqual([
      ["link", "docs/setup.md#x", "Rules"],
      ["link", "https://a.com", "Rules"],
      ["image", "a.png", "Rules"],
      ["image", "b.png", "Rules"],
    ]);
  });

  it("flags empty alt text", () => {
    expect(refs.find((r) => r.target === "a.png")?.alt).toBe("");
    expect(refs.find((r) => r.target === "b.png")?.alt).toBe("ok");
  });

  it("tells files from URLs and anchors", () => {
    expect(isRelativeFile("docs/a.md")).toBe(true);
    expect(isRelativeFile("https://a.com")).toBe(false);
    expect(isRelativeFile("#top")).toBe(false);
    expect(isRelativeFile("mailto:a@b.c")).toBe(false);
  });
});
