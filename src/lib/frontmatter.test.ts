import { describe, expect, it } from "vitest";
import {
  blankFrontmatter,
  listItems,
  parseProperties,
  setProperty,
  splitFrontmatter,
} from "./frontmatter";

const FM = "---\ndescription: Conventions\napplies to: [Claude Code, Codex]\n---\n";

describe("splitFrontmatter", () => {
  it("separates the block from the body, byte for byte", () => {
    const { frontmatter, body } = splitFrontmatter(`${FM}\n# Title\n`);
    expect(frontmatter).toBe(FM);
    expect(body).toBe("\n# Title\n");
  });

  it("finds none in a file that does not start with ---", () => {
    expect(splitFrontmatter("# Title\n---\nx\n---\n").frontmatter).toBe("");
  });

  it("handles an empty block and CRLF", () => {
    expect(splitFrontmatter("---\n---\nbody").frontmatter).toBe("---\n---\n");
    expect(splitFrontmatter("---\r\na: 1\r\n---\r\nbody").body).toBe("body");
  });
});

describe("parseProperties", () => {
  it("lists simple key: value pairs", () => {
    const props = parseProperties(FM);
    expect(props.map((p) => [p.key, p.value])).toEqual([
      ["description", "Conventions"],
      ["applies to", "[Claude Code, Codex]"],
    ]);
    expect(props.every((p) => p.editable)).toBe(true);
  });

  it("marks multi-line values as not editable in place", () => {
    const props = parseProperties("---\nname: x\ntools:\n  - a\n  - b\ntext: |\n  hi\n---\n");
    expect(props.find((p) => p.key === "tools")?.editable).toBe(false);
    expect(props.find((p) => p.key === "text")?.editable).toBe(false);
    expect(props.find((p) => p.key === "name")?.editable).toBe(true);
  });

  it("reads a flow list as items", () => {
    expect(listItems("[Claude Code, Codex, 'Cursor']")).toEqual(["Claude Code", "Codex", "Cursor"]);
    expect(listItems("plain")).toBeNull();
  });
});

describe("setProperty", () => {
  it("changes one value and leaves every other character alone", () => {
    const [first] = parseProperties(FM);
    expect(setProperty(FM, first.line, "New text")).toBe(
      "---\ndescription: New text\napplies to: [Claude Code, Codex]\n---\n",
    );
  });
});

describe("blankFrontmatter", () => {
  it("keeps the line count so headings keep their line numbers", () => {
    const text = `${FM}# Title\n`;
    const blank = blankFrontmatter(text);
    expect(blank.split("\n")).toHaveLength(text.split("\n").length);
    expect(blank.trimStart()).toBe("# Title\n");
  });
});
