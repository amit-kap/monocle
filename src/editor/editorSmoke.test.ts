import { describe, expect, it } from "vitest";
import { toMarkdown } from "../lib/markdown";
import { makeTestEditor } from "./testEditor";

describe("editor setup", () => {
  it("mounts the shared extension stack", () => {
    const editor = makeTestEditor("# Hello");
    expect(editor.getHTML()).toContain("Hello");
    editor.destroy();
  });

  it("mounts the extensions the app relies on", () => {
    const editor = makeTestEditor();
    const names = editor.extensionManager.extensions.map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "starterKit",
        "taskList",
        "taskItem",
        "markdown",
        "placeholder",
        "slashCommand",
        "softBreakSpace",
      ]),
    );
    editor.destroy();
  });

  it("does not register the underline mark, which cannot be serialized", () => {
    const editor = makeTestEditor();
    expect(editor.schema.marks.underline).toBeUndefined();
    editor.destroy();
  });

  it("renders the block types the slash menu offers", () => {
    const editor = makeTestEditor();
    for (const name of [
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "taskList",
      "blockquote",
      "codeBlock",
      "horizontalRule",
    ]) {
      expect(editor.schema.nodes[name], name).toBeDefined();
    }
    editor.destroy();
  });

  it("keeps the markdown storage reachable for saving", () => {
    const editor = makeTestEditor("text");
    expect(toMarkdown(editor)).toBe("text");
    editor.destroy();
  });
});