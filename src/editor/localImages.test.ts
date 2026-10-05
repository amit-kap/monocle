import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Pretend to be running under Tauri so the asset-protocol branch is exercised.
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  convertFileSrc: (path: string) =>
    `asset://localhost${encodeURIComponent(path)}`,
}));

import { makeTestEditor, onDisk } from "./testEditor";
import { toMarkdown } from "../lib/markdown";
import {
  applyImageSources,
  setImageBaseDir,
} from "./extensions/LocalImages";

function images(editor: ReturnType<typeof makeTestEditor>): HTMLImageElement[] {
  return [...editor.view.dom.querySelectorAll("img")].filter(
    (img) => !img.classList.contains("ProseMirror-separator"),
  );
}

const NOTE = [
  "# Images",
  "",
  "![relative](diagram.png)",
  "",
  "![nested](sub/shot.png)",
  "",
  "![remote](https://example.com/a.png)",
  "",
  "![data](data:image/png;base64,AAAA)",
].join("\n");

describe("local image sources", () => {
  beforeEach(() => setImageBaseDir("/Users/me/notes"));
  afterEach(() => setImageBaseDir(null));

  it("rewrites a relative path to an asset url", () => {
    const editor = makeTestEditor(NOTE);
    applyImageSources(editor.view.dom as HTMLElement);

    const [relative] = images(editor);
    expect(relative.getAttribute("data-local-src")).toBe(
      "/Users/me/notes/diagram.png",
    );
    expect(relative.getAttribute("src")).toContain("asset://localhost");
    editor.destroy();
  });

  it("resolves a subfolder path against the note's folder", () => {
    const editor = makeTestEditor(NOTE);
    applyImageSources(editor.view.dom as HTMLElement);

    const nested = images(editor)[1];
    expect(nested.getAttribute("data-local-src")).toBe(
      "/Users/me/notes/sub/shot.png",
    );
    editor.destroy();
  });

  it("leaves remote and data sources alone", () => {
    const editor = makeTestEditor(NOTE);
    applyImageSources(editor.view.dom as HTMLElement);

    const [, , remote, data] = images(editor);
    expect(remote.getAttribute("src")).toBe("https://example.com/a.png");
    expect(data.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    editor.destroy();
  });

  it("does not touch the document, so the note still saves its own paths", () => {
    const editor = makeTestEditor(NOTE);
    const before = JSON.stringify(editor.getJSON());
    applyImageSources(editor.view.dom as HTMLElement);
    expect(JSON.stringify(editor.getJSON())).toBe(before);
    expect(toMarkdown(editor)).toBe(onDisk(NOTE));
    editor.destroy();
  });

  it("keeps the author's path in data-src so it can be re-resolved", () => {
    const editor = makeTestEditor("![a diagram](diagram.png)\n");
    applyImageSources(editor.view.dom as HTMLElement);

    const [img] = images(editor);
    expect(img.getAttribute("data-src")).toBe("diagram.png");
    editor.destroy();
  });

  it("re-resolves from the original path after the note changes", () => {
    const editor = makeTestEditor("![x](diagram.png)\n");
    applyImageSources(editor.view.dom as HTMLElement);
    const first = images(editor)[0].getAttribute("src");

    // Switching notes leaves the rendered asset url in the DOM. Re-running must
    // resolve from the stashed original, or the image keeps pointing at the
    // previous note's folder.
    setImageBaseDir("/Users/me/other");
    applyImageSources(editor.view.dom as HTMLElement);

    const img = images(editor)[0];
    expect(img.getAttribute("data-local-src")).toBe("/Users/me/other/diagram.png");
    expect(img.getAttribute("src")).not.toBe(first);
    editor.destroy();
  });

  it("is idempotent", () => {
    const editor = makeTestEditor(NOTE);
    const dom = editor.view.dom as HTMLElement;
    applyImageSources(dom);
    const once = images(editor).map((i) => i.getAttribute("src"));
    applyImageSources(dom);
    applyImageSources(dom);
    expect(images(editor).map((i) => i.getAttribute("src"))).toEqual(once);
    editor.destroy();
  });

  it("leaves relative paths alone when no note is open", () => {
    setImageBaseDir(null);
    const editor = makeTestEditor("![x](diagram.png)\n");
    applyImageSources(editor.view.dom as HTMLElement);

    const [img] = images(editor);
    expect(img.getAttribute("src")).toBe("diagram.png");
    expect(img.getAttribute("data-local-src")).toBeNull();
    editor.destroy();
  });
});