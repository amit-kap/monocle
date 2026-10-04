import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { resolveImagePath } from "../../lib/imagePath";

// The folder of the note currently open, set by the editor pane. Kept here
// rather than read from the store because the plugin is created once, before
// any note is open.
let baseDir: string | null = null;

export function setImageBaseDir(dir: string | null): void {
  baseDir = dir;
}

export function getImageBaseDir(): string | null {
  return baseDir;
}

/**
 * Points every local <img> at Tauri's asset protocol, leaving the document
 * untouched so the note still saves with the author's own relative paths.
 *
 * The original path is stashed in `data-src` so this stays idempotent: the
 * rendered src is an asset URL, and re-running must resolve from the original
 * rather than treat the asset URL as the source path (which would leave a stale
 * image behind after switching notes).
 */
export function applyImageSources(root: HTMLElement): void {
  for (const img of root.querySelectorAll("img")) {
    const original = img.getAttribute("data-src") ?? img.getAttribute("src");
    if (original === null) continue;

    const local = resolveImagePath(original, baseDir);
    if (!local || !isTauri()) continue;

    img.setAttribute("data-src", original);
    img.setAttribute("data-local-src", local);
    img.src = convertFileSrc(local);
  }
}

export const LocalImages = Extension.create({
  name: "localImages",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: (view) => {
          applyImageSources(view.dom as HTMLElement);
          return {
            update: () => applyImageSources(view.dom as HTMLElement),
          };
        },
      }),
    ];
  },
});