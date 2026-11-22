import type { TreeNode } from "../types";

const SKILL = "SKILL.md";

/**
 * The tree as the sidebar draws it. Two folds:
 *
 * - A folder whose only child is one folder merges with it into one row
 *   (`Research / _feeds / 2026`).
 * - A folder whose only child is `SKILL.md` shows as one file row
 *   (`pipeline / SKILL.md`).
 *
 * A folded row keeps the outermost folder's path (what the chevron expands) and
 * names the innermost one in `openPath` (what the folder page opens).
 */
export function foldTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.kind === "file") return node;
    // A Place is a header: it never merges with what is inside it.
    if (node.place) return { ...node, children: foldTree(node.children ?? []) };

    const label = [node.name];
    let current = node;
    let children = current.children ?? [];
    while (children.length === 1 && children[0].kind === "dir") {
      current = children[0];
      label.push(current.name);
      children = current.children ?? [];
    }

    if (children.length === 1 && children[0].name === SKILL) {
      return { ...children[0], label: [...label, SKILL], size: children[0].size };
    }

    return {
      ...node,
      label: label.length > 1 ? label : undefined,
      openPath: current.path,
      children: foldTree(children),
    };
  });
}

/** A folder with nothing inside at all: no chevron, nothing to expand. */
export function isEmptyDir(node: TreeNode): boolean {
  return node.kind === "dir" && (node.children?.length ?? 0) === 0;
}

/** A hidden (dot-named) folder, or a folded row with one in its trail. */
export function isHiddenDir(node: TreeNode): boolean {
  return node.kind === "dir" && (node.label ?? [node.name]).some((n) => n.startsWith("."));
}

/** The row's text: folded names joined, outermost first. */
export function rowLabel(node: TreeNode): string {
  return node.label ? node.label.join(" / ") : node.name;
}

export function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.kind === "dir" && node.children && path.startsWith(`${node.path}/`)) {
      const hit = findNode(node.children, path);
      if (hit) return hit;
    }
  }
  return null;
}

/** Markdown files inside a folder, at any depth. */
export function countFiles(node: TreeNode): number {
  if (node.kind === "file") return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countFiles(child), 0);
}

/** Every folder from `root` down to `path`, outermost first, for expanding a trail. */
export function trailTo(root: string, path: string): string[] {
  const rest = path.slice(root.length).split("/").filter(Boolean);
  const out: string[] = [];
  let current = root;
  for (const part of rest) {
    current = `${current}/${part}`;
    out.push(current);
  }
  return out;
}

export function baseName(path: string): string {
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return trimmed.split("/").pop() || trimmed;
}

export function parentDir(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut > 0 ? path.slice(0, cut) : "/";
}

/** Every ancestor folder of `path` up to and including `home`, nearest first. */
export function ancestorsUpToHome(path: string, home: string): string[] {
  const out: string[] = [];
  let current = path;
  while (current !== home && current.length > 1 && current.startsWith(`${home}/`)) {
    current = parentDir(current);
    out.push(current);
  }
  return out;
}

/** What the breadcrumb shows for an item: root to item, or the last three parts. */
export function crumbTrail(
  root: string | null,
  path: string,
): { inside: boolean; parts: { name: string; path: string }[] } {
  const inside = root !== null && (path === root || path.startsWith(`${root}/`));
  if (root !== null && inside) {
    const parts = [{ name: baseName(root), path: root }];
    for (const step of trailTo(root, path)) {
      parts.push({ name: baseName(step), path: step });
    }
    return { inside, parts };
  }
  const names = path.split("/").filter(Boolean).slice(-3);
  return { inside, parts: names.map((name) => ({ name, path: "" })) };
}

/** Whether a folder's contents hold a note at any depth. */
function holdsNotes(children: TreeNode[]): boolean {
  return children.some((c) => c.kind === "file" || c.hasNotes === true);
}

/**
 * The tree with `dir`'s contents replaced by `children`, and `hasNotes`
 * recomputed on every folder from there up to the top. Returns null when
 * `dir` is not in the tree, so the caller can try its parent instead.
 */
export function replaceDir(
  nodes: TreeNode[],
  dir: string,
  children: TreeNode[],
): TreeNode[] | null {
  // Every copy is replaced: with nested Places (`~` and `~/.claude`) one
  // folder sits in the tree twice.
  let found = false;
  const next = nodes.map((node) => {
    if (node.kind !== "dir") return node;
    if (node.path === dir) {
      found = true;
      return { ...node, children, hasNotes: holdsNotes(children) };
    }
    if (node.children && dir.startsWith(`${node.path}/`)) {
      const inner = replaceDir(node.children, dir, children);
      if (inner) {
        found = true;
        return { ...node, children: inner, hasNotes: holdsNotes(inner) };
      }
    }
    return node;
  });
  return found ? next : null;
}

/** Hidden folders that show with hidden files off. Mirrors `AGENT_DIRS` in `src-tauri/src/tree.rs`. */
export const AGENT_DIRS = new Set([
  ".claude",
  ".codex",
  ".cursor",
  ".github",
  ".agents",
  ".gemini",
  ".windsurf",
  ".continue",
  ".aider",
]);

/** Whether `path` (under `root`) is somewhere the tree shows. */
export function isShown(root: string, path: string, showHidden: boolean): boolean {
  if (path !== root && !path.startsWith(`${root}/`)) return false;
  if (showHidden) return true;
  return path
    .slice(root.length)
    .split("/")
    .every((part) => !part.startsWith(".") || AGENT_DIRS.has(part));
}

/** The folders to rescan for a set of changed paths: each one's parent. */
export function dirsToRescan(paths: string[]): string[] {
  return outermost(paths.map(parentDir));
}

/** `dirs` without any that sit inside another one of them. */
export function outermost(dirs: string[]): string[] {
  const sorted = [...new Set(dirs)].sort((a, b) => a.length - b.length);
  const out: string[] = [];
  for (const dir of sorted) {
    if (!out.some((kept) => dir === kept || dir.startsWith(`${kept}/`))) out.push(dir);
  }
  return out;
}

/** The Place `path` belongs to: the deepest one that holds it, or null. */
export function placeOf(places: string[], path: string | null): string | null {
  if (!path) return null;
  let best: string | null = null;
  for (const place of places) {
    if ((path === place || path.startsWith(`${place}/`)) && (!best || place.length > best.length)) {
      best = place;
    }
  }
  return best;
}

/**
 * The top-level row for each Place. Two Places with the same name each carry
 * their parent folder as a hint, so they can be told apart.
 */
export function placeNodes(
  places: string[],
  contents: (TreeNode[] | null)[],
): TreeNode[] {
  const names = places.map(baseName);
  return places.map((path, i) => {
    const children = contents[i] ?? [];
    const twin = names.filter((n) => n === names[i]).length > 1;
    return {
      name: names[i],
      path,
      kind: "dir",
      place: true,
      children,
      hasNotes: holdsNotes(children),
      ...(twin ? { hint: baseName(parentDir(path)) } : {}),
      ...(contents[i] === null ? { missing: true } : {}),
    };
  });
}
