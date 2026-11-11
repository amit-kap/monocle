import { describe, expect, it } from "vitest";
import { agentPathReference, projectFolder, wrapContents } from "./agentRef";

/** A fake disk: the set of "dir/name" entries that exist. */
const disk = (entries: string[]) => async (dir: string, name: string) =>
  entries.includes(`${dir}/${name}`);

const HOME = "/Users/me";

describe("agentPathReference", () => {
  it("is relative to the nearest project folder", async () => {
    const has = disk(["/Users/me/Projects/app/CLAUDE.md"]);
    expect(
      await agentPathReference("/Users/me/Projects/app/docs/guide.md", HOME, has),
    ).toBe("@docs/guide.md");
  });

  it("recognises AGENTS.md, .claude and .git as project markers", async () => {
    for (const marker of ["AGENTS.md", ".claude", ".git"]) {
      const has = disk([`/Users/me/p/${marker}`]);
      expect(await projectFolder("/Users/me/p/a/b.md", HOME, has)).toBe("/Users/me/p");
    }
  });

  it("uses the nearest project when projects nest", async () => {
    const has = disk(["/Users/me/p/CLAUDE.md", "/Users/me/p/sub/.git"]);
    expect(await agentPathReference("/Users/me/p/sub/x.md", HOME, has)).toBe("@x.md");
  });

  it("falls back to the path from home with no project folder", async () => {
    const has = disk([]);
    expect(await agentPathReference("/Users/me/.claude/CLAUDE.md", HOME, has)).toBe(
      "~/.claude/CLAUDE.md",
    );
  });

  it("does not treat the home folder itself as a project", async () => {
    const has = disk(["/Users/me/.claude", "/Users/me/CLAUDE.md"]);
    expect(await projectFolder("/Users/me/notes/a.md", HOME, has)).toBeNull();
  });
});

describe("wrapContents", () => {
  it("wraps the text with the filename", () => {
    expect(wrapContents("/x/CLAUDE.md", "hello\n")).toBe(
      '<file name="CLAUDE.md">\nhello\n</file>',
    );
  });
});
