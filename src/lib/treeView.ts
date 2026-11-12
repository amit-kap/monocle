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
  root: string,
  path: string,
): { inside: boolean; parts: { name: string; path: string }[] } {
  const inside = path === root || path.startsWith(`${root}/`);
  if (inside) {
    const parts = [{ name: baseName(root), path: root }];
    for (const step of trailTo(root, path)) {
      parts.push({ name: baseName(step), path: step });
    }
    return { inside, parts };
  }
  const names = path.split("/").filter(Boolean).slice(-3);
  return { inside, parts: names.map((name) => ({ name, path: "" })) };
}
