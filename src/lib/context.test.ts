import { describe, expect, it } from "vitest";
import { linkedFiles, linkedFrom, resolveTarget, runChecks } from "./context";

describe("resolveTarget", () => {
  it("resolves relative paths against the file's folder", () => {
    expect(resolveTarget("/p/docs/a.md", "b.md")).toBe("/p/docs/b.md");
    expect(resolveTarget("/p/docs/a.md", "../README.md")).toBe("/p/README.md");
    expect(resolveTarget("/p/docs/a.md", "./sub/c.md#top")).toBe("/p/docs/sub/c.md");
    expect(resolveTarget("/p/docs/a.md", "/abs/x.md")).toBe("/abs/x.md");
  });
});

describe("linkedFiles", () => {
  it("lists distinct markdown files a note links to", () => {
    const text = "[a](b.md) [again](b.md#x) [c](../c.markdown) [site](https://x.y) [img](p.png)";
    expect(linkedFiles(text, "/p/docs/a.md")).toEqual(["/p/docs/b.md", "/p/c.markdown"]);
  });

  it("does not count a link to itself", () => {
    expect(linkedFiles("[me](a.md)", "/p/a.md")).toEqual([]);
  });
});

describe("runChecks", () => {
  const exists = async (path: string) => path === "/p/docs/real.md";

  it("reports a broken relative link and names its section", async () => {
    const text = "## Testing rules\n\nSee [setup](docs/setup.md) and [real](docs/real.md).\n";
    const checks = await runChecks(text, "/p/CLAUDE.md", exists);
    expect(checks).toEqual([{ message: "Broken link to docs/setup.md", section: "Testing rules" }]);
  });

  it("reports an image with no alt text", async () => {
    const checks = await runChecks("## Editor layout\n\n![](assets/x.png)\n", "/p/a.md", exists);
    expect(checks).toEqual([{ message: "Image has no alt text", section: "Editor layout" }]);
  });

  it("ignores URLs, anchors and a clean note", async () => {
    const text = "[a](https://x.y) [b](#top) ![ok](p.png)";
    expect(await runChecks(text, "/p/a.md", exists)).toEqual([]);
  });
});

describe("linkedFrom", () => {
  it("finds the notes that link to a file", () => {
    const texts = new Map([
      ["/p/README.md", "see [guide](CLAUDE.md)"],
      ["/p/docs/a.md", "see [guide](../CLAUDE.md)"],
      ["/p/docs/b.md", "nothing here"],
    ]);
    expect(linkedFrom(texts, "/p/CLAUDE.md")).toEqual(["/p/README.md", "/p/docs/a.md"]);
  });
});
