/**
 * Dev only: lets the UI run in a plain browser (`npm run dev`, then open
 * localhost:1420) by answering Tauri's IPC from an in-memory copy of `demo/`.
 * Writes land in memory and vanish on reload. Never part of a Tauri build:
 * main.tsx loads this only when `isTauri()` is false in dev.
 */
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { TreeNode } from "../types";

const ROOT = "/demo";

const raw = import.meta.glob("/demo/**/*.{md,markdown}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const files = new Map<string, string>(Object.entries(raw));
const dirs = new Set<string>([ROOT]);
for (const path of files.keys()) {
  let dir = path.slice(0, path.lastIndexOf("/"));
  while (dir.startsWith(ROOT)) {
    dirs.add(dir);
    dir = dir.slice(0, dir.lastIndexOf("/"));
  }
}

const dirname = (p: string) => p.slice(0, p.lastIndexOf("/")) || "/";
const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const join = (...parts: string[]) => parts.join("/").replace(/\/+/g, "/");

function scan(root: string): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const dir of dirs) {
    if (dirname(dir) !== root || dir === root) continue;
    const children = scan(dir);
    const hasNotes = [...files.keys()].some((f) => f.startsWith(`${dir}/`));
    nodes.push({ name: basename(dir), path: dir, kind: "dir", children, hasNotes });
  }
  for (const [path, text] of files) {
    if (dirname(path) !== root) continue;
    nodes.push({ name: basename(path), path, kind: "file", size: text.length });
  }
  return nodes.sort((a, b) =>
    a.kind !== b.kind ? (a.kind === "file" ? -1 : 1) : a.name.localeCompare(b.name),
  );
}

type Args = Record<string, unknown>;

const handlers: Record<string, (args: Args) => unknown> = {
  frontend_ready: () => null,
  start_watch: () => null,
  stop_watch: () => null,
  scan_tree: (a) => scan(a.root as string),
  write_file_atomic: (a) => void files.set(a.path as string, a.contents as string),
  create_dir: (a) => void dirs.add(a.path as string),
  trash_path: (a) => {
    const p = a.path as string;
    files.delete(p);
    dirs.delete(p);
  },
  save_asset: () => "assets/pasted.png",
  "plugin:path|resolve_directory": () => ROOT,
  "plugin:path|join": (a) => join(...(a.paths as string[])),
  "plugin:path|dirname": (a) => dirname(a.path as string),
  "plugin:path|basename": (a) => basename(a.path as string),
  "plugin:fs|exists": (a) => files.has(a.path as string) || dirs.has(a.path as string),
  "plugin:fs|read_text_file": (a) => {
    const text = files.get(a.path as string);
    if (text === undefined) throw new Error(`No such file: ${a.path}`);
    return Array.from(new TextEncoder().encode(text));
  },
  "plugin:fs|rename": (a) => {
    const from = a.oldPath as string;
    const text = files.get(from);
    if (text !== undefined) {
      files.delete(from);
      files.set(a.newPath as string, text);
    }
  },
  "plugin:dialog|open": () => null,
  "plugin:opener|reveal_item_in_dir": () => null,
  "plugin:window|set_theme": () => null,
};

export function installBrowserMock(): void {
  clearMocks();
  mockWindows("main");
  mockIPC(
    (cmd, args) => {
      const handler = handlers[cmd];
      if (handler) return handler((args ?? {}) as Args);
      console.debug("[browser mock] unhandled", cmd, args);
      return null;
    },
    { shouldMockEvents: true },
  );
  // Show the demo folder on first run instead of an empty sidebar.
  if (!localStorage.getItem("monocle:places")) {
    localStorage.setItem("monocle:places", JSON.stringify([ROOT]));
  }
}
