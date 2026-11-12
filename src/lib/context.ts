import { extractReferences, isRelativeFile, stripAnchor, type Reference } from "./outline";
import { parentDir } from "./treeView";

/** Where a link in `fromFile` points, as an absolute path. */
export function resolveTarget(fromFile: string, target: string): string {
  const clean = stripAnchor(target);
  const parts = clean.startsWith("/") ? [] : parentDir(fromFile).split("/").filter(Boolean);
  for (const part of clean.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

const MD = /\.(md|markdown)$/i;

/** Links from a note to other markdown files, resolved and de-duplicated. */
export function linkedFiles(text: string, fromFile: string): string[] {
  const seen = new Set<string>();
  for (const ref of extractReferences(text)) {
    if (ref.kind !== "link" || !isRelativeFile(ref.target)) continue;
    if (stripAnchor(ref.target) === "") continue;
    const path = resolveTarget(fromFile, ref.target);
    if (MD.test(path) && path !== fromFile) seen.add(path);
  }
  return [...seen];
}

export type Check = { message: string; section: string | null };

/**
 * Problems in a note: relative links to files that do not exist, and images
 * with no alt text. Each names the section it is in.
 */
export async function runChecks(
  text: string,
  fromFile: string,
  exists: (path: string) => Promise<boolean>,
): Promise<Check[]> {
  const checks: Check[] = [];
  const refs: Reference[] = extractReferences(text);
  for (const ref of refs) {
    if (ref.kind === "image" && ref.alt.trim() === "") {
      checks.push({ message: "Image has no alt text", section: ref.section });
    }
    if (ref.kind === "link" && isRelativeFile(ref.target) && stripAnchor(ref.target) !== "") {
      if (!(await exists(resolveTarget(fromFile, ref.target)))) {
        checks.push({
          message: `Broken link to ${stripAnchor(ref.target)}`,
          section: ref.section,
        });
      }
    }
  }
  return checks;
}

/** Which of `texts` (path → contents) link to `target`. */
export function linkedFrom(texts: Map<string, string>, target: string): string[] {
  const out: string[] = [];
  for (const [path, text] of texts) {
    if (path !== target && linkedFiles(text, path).includes(target)) out.push(path);
  }
  return out.sort();
}
