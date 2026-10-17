// Keyboard navigation for the sidebar tree. The rows are derived from the same
// nodes the sidebar renders, so what a key press does can be reasoned about —
// and tested — without a DOM.

import type { TreeNode } from "../types";

export type TreeRow = {
  path: string;
  kind: "file" | "dir";
  depth: number;
  /** Folders only: whether the row is showing its children. */
  open: boolean;
};

/**
 * The rows the sidebar shows, in visual order: a folder's children follow it
 * when it is open, and folded-away rows are left out entirely.
 */
export function visibleRows(
  nodes: TreeNode[],
  options: { expanded: Set<string>; forceExpand?: boolean },
  depth = 0,
): TreeRow[] {
  const rows: TreeRow[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      rows.push({ path: node.path, kind: "file", depth, open: false });
      continue;
    }
    const open = Boolean(options.forceExpand) || options.expanded.has(node.path);
    rows.push({ path: node.path, kind: "dir", depth, open });
    if (open && node.children) {
      rows.push(...visibleRows(node.children, options, depth + 1));
    }
  }
  return rows;
}

export type TreeStep = { index: number; toggle?: boolean };

/** The folder a row sits in, or null for a top-level row. */
function parentPath(row: TreeRow): string | null {
  const cut = row.path.lastIndexOf("/");
  return cut > 0 ? row.path.slice(0, cut) : null;
}

/**
 * Where a key press moves the focus. `index` is the focused row, or -1 when
 * nothing in the tree is focused yet (then the first arrow lands on the first
 * row). Returns null for keys the tree does not own, so they keep whatever
 * behaviour they had.
 *
 * `toggle` means the row's folder should open or close — and never applies
 * while searching, where every folder is shown open, so a collapse there would
 * only show up once the search was cleared.
 */
export function stepRow(
  rows: TreeRow[],
  index: number,
  key: string,
  options: { canToggle?: boolean } = {},
): TreeStep | null {
  if (rows.length === 0) return null;
  const last = rows.length - 1;
  const current = index < 0 ? -1 : Math.min(index, last);
  const canToggle = options.canToggle !== false;

  switch (key) {
    case "ArrowDown":
      return { index: Math.min(current + 1, last) };
    case "ArrowUp":
      return { index: Math.max(current - 1, 0) };
    case "Home":
      return { index: 0 };
    case "End":
      return { index: last };
    case "ArrowRight": {
      const row = rows[current];
      // Open a closed folder; an open one steps into it (its first child is
      // the next row), and a file just moves on.
      if (!row) return { index: 0 };
      if (row.kind === "dir" && !row.open) {
        return canToggle ? { index: current, toggle: true } : null;
      }
      return { index: Math.min(current + 1, last) };
    }
    case "ArrowLeft": {
      const row = rows[current];
      if (!row) return null;
      // Closing an open folder comes first; with nothing to close (a file, a
      // folded folder, or a search that holds every folder open) move out to
      // the folder it sits in.
      if (row.kind === "dir" && row.open && canToggle) {
        return { index: current, toggle: true };
      }
      const parent = parentPath(row);
      if (parent === null) return null;
      const found = rows.findIndex((candidate) => candidate.path === parent);
      return found === -1 ? null : { index: found };
    }
    default:
      return null;
  }
}
