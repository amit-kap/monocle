// Images in a note are written with paths relative to the note's own folder
// (`diagram.png`, `assets/shot.png`), but the webview's origin is the app
// itself, so those paths resolve to nothing. Tauri's asset protocol serves them
// instead, which means turning the note-relative path into an absolute one.
//
// The document must keep the author's original path: changing the node's `src`
// would rewrite the markdown on the next save. So the absolute path is applied
// to the rendered <img> only, and the original is remembered alongside it.

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

export function isRemoteSrc(src: string): boolean {
  // http:, https:, data:, asset:, blob: — anything already addressable.
  return ABSOLUTE_URL.test(src);
}

export function isAbsolutePath(path: string): boolean {
  return path.startsWith("/");
}

function decode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    // A literal '%' that is not a valid escape: use it as written.
    return path;
  }
}

/** Joins a POSIX-style relative path onto a directory, honouring `.` and `..`. */
export function joinPath(dir: string, relative: string): string {
  const parts = dir.split("/").filter(Boolean);
  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return `/${parts.join("/")}`;
}

/**
 * The absolute local path an image points at, or null when there is nothing to
 * resolve — an empty src, a remote URL, or a relative path with no note open.
 */
export function resolveImagePath(
  rawSrc: string,
  baseDir: string | null,
): string | null {
  const src = decode(rawSrc.trim()).replace(/^<|>$/g, "");
  if (!src || isRemoteSrc(src)) return null;
  if (isAbsolutePath(src)) return src;
  if (!baseDir) return null;
  return joinPath(baseDir, src);
}

/** The folder a note lives in, used as the base for its relative images. */
export function noteDir(notePath: string | null): string | null {
  if (!notePath) return null;
  const slash = notePath.lastIndexOf("/");
  return slash > 0 ? notePath.slice(0, slash) : null;
}