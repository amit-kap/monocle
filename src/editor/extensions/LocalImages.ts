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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * A small inline SVG that stands in for a failed image and shows its path.
 * A swapped src keeps the node a valid image (the document is untouched),
 * which a styled <div> replacement could not — ProseMirror owns this DOM.
 * `monocle-missing` marks the placeholder so it is never treated as the
 * author's own source.
 */
function missingImageSrc(path: string): string {
  const label = path.length > 90 ? `…${path.slice(-89)}` : path;
  const text = `Image not found: ${label}`;
  const width = Math.ceil(24 + text.length * 6.4);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="32">` +
    `<!--monocle-missing-->` +
    `<style>rect{fill:#f4f2ee;stroke:#ddd7cd}text{fill:#8a8177;font:12.5px -apple-system,sans-serif}` +
    `@media (prefers-color-scheme:dark){rect{fill:#26251f;stroke:#3d3a33}text{fill:#8d877d}}</style>` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="31" rx="6"/>` +
    `<text x="12" y="21">${escapeXml(text)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Swaps a failed image for a placeholder carrying its path, so a typo'd
 * filename is visible and fixable instead of the broken-image glyph. The
 * original stays in `data-src`, so a later pass can still re-resolve it.
 */
function markImageFailed(img: HTMLImageElement): void {
  const original = img.getAttribute("data-src") ?? img.getAttribute("src");
  if (!original || original.includes("monocle-missing")) return;
  if (img.classList.contains("image-failed")) return;
  img.setAttribute("data-src", original);
  img.classList.add("image-failed");
  img.src = missingImageSrc(original);
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

    img.onerror = () => markImageFailed(img);

    const local = resolveImagePath(original, baseDir);
    if (!local || !isTauri()) continue;

    // Clearing the flag before the retry lets a file that now exists come
    // back; if it still fails, the error listener marks it again.
    img.classList.remove("image-failed");
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