import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { TreeNode } from "./types";

// Plan conformance: one test per item of brief-gap-plan.md, run against the
// whole app with the file system mocked. Each describe is a milestone.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOME = "/Users/me";
const ROOT = "/Users/me/Projects";

const file = (name: string, dir: string, size = 700): TreeNode => ({
  name,
  path: `${dir}/${name}`,
  kind: "file",
  size,
});
const dir = (name: string, parent: string, children: TreeNode[]): TreeNode => ({
  name,
  path: `${parent}/${name}`,
  kind: "dir",
  children,
});

const TREE: TreeNode[] = [
  file("CLAUDE.md", ROOT, 3500),
  file("README.md", ROOT, 700),
  dir("docs", ROOT, [file("architecture.md", `${ROOT}/docs`, 1400), file("release.md", `${ROOT}/docs`)]),
  dir("pipeline", ROOT, [file("SKILL.md", `${ROOT}/pipeline`)]),
  dir("Research", ROOT, [
    dir("_feeds", `${ROOT}/Research`, [
      dir("2026", `${ROOT}/Research/_feeds`, [file("weekly.md", `${ROOT}/Research/_feeds/2026`)]),
    ]),
  ]),
];

const CLAUDE = `---
description: Conventions
applies to: [Claude Code, Codex]
---

# Agent guide

Intro with a [broken](docs/setup.md) link and a [real one](docs/architecture.md).

## Build and run

Use pnpm.

![](assets/x.png)

## Testing rules

Run tests.
`;

const TEXTS: Record<string, string> = {
  [`${ROOT}/CLAUDE.md`]: CLAUDE,
  [`${ROOT}/README.md`]: "# Readme\n\nSee [guide](CLAUDE.md).\n",
  [`${ROOT}/docs/architecture.md`]: "# Architecture\n\nWords here.\n",
};

const fsMock = vi.hoisted(() => ({
  writes: [] as [string, string][],
  trashed: [] as string[],
  tree: [] as TreeNode[],
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setTitle: vi.fn(async () => {}),
    onCloseRequested: vi.fn(async () => () => {}),
    destroy: vi.fn(async () => {}),
  }),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
const invoke = vi.hoisted(() =>
  vi.fn(async (cmd: string, _args?: unknown): Promise<unknown> =>
    cmd === "save_asset" ? "assets/image-1.png" : undefined,
  ),
);
vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  isTauri: () => false,
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn(async () => "/Users/me"),
  dirname: vi.fn(async (p: string) => p.slice(0, p.lastIndexOf("/"))),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: vi.fn(),
  exists: vi.fn(async () => true),
  readTextFile: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(async () => ({ size: 0 })),
}));
vi.mock("./lib/fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/fs")>();
  return {
    ...actual,
    readTree: vi.fn(async () => fsMock.tree),
    readNote: vi.fn(async (p: string) => TEXTS[p] ?? ""),
    writeNote: vi.fn(async (p: string, c: string) => {
      fsMock.writes.push([p, c]);
    }),
    pathExists: vi.fn(async (p: string) => p === `${ROOT}/docs/architecture.md` || p.endsWith("/CLAUDE.md")),
    trashPath: vi.fn(async (p: string) => {
      fsMock.trashed.push(p);
    }),
    createNoteFile: vi.fn(async () => `${ROOT}/untitled.md`),
    createDirectory: vi.fn(async () => `${ROOT}/untitled folder`),
    startWatch: vi.fn(async () => {}),
  };
});

const { default: App } = await import("./App");
const { useStore } = await import("./store/useStore");
const { useModalPrompt } = await import("./store/useModalPrompt");

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = RO;
Range.prototype.getBoundingClientRect = () => new DOMRect();
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Element.prototype.scrollIntoView = vi.fn();
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn(async () => {}) },
  configurable: true,
});

let container: HTMLDivElement;
let root: Root;

const q = <T extends Element = HTMLElement>(sel: string) => container.querySelector<T>(sel);
const qa = <T extends Element = HTMLElement>(sel: string) => Array.from(container.querySelectorAll<T>(sel));
const text = () => container.textContent ?? "";
async function tick(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
function click(el: Element | null) {
  if (!el) throw new Error("element not found");
  act(() => {
    (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
function key(init: KeyboardEventInit) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
}
const row = (path: string) => q(`[data-tree-row="${path}"]`);
const rowPaths = () => qa("[data-tree-row]").map((r) => r.dataset.treeRow);

async function boot(setup: Partial<ReturnType<typeof useStore.getState>> = {}) {
  localStorage.clear();
  localStorage.setItem("monocle:lastFolder", ROOT);
  fsMock.writes.length = 0;
  fsMock.trashed.length = 0;
  fsMock.tree = TREE;
  useModalPrompt.setState({ pending: null });
  useStore.setState({
    folder: null,
    tree: [],
    notes: [],
    expanded: new Set(),
    activePath: null,
    activeContent: "",
    folderPage: null,
    selectedDir: null,
    status: "idle",
    changes: {},
    liveText: "",
    diskText: "",
    leftOpen: true,
    rightOpen: true,
    rightTab: "outline",
    view: "rich",
    settingsOpen: false,
    renamingPath: null,
    madeDirs: new Set(),
    recentRoots: [],
    error: null,
    ...setup,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  await tick(20);
}

async function openClaude() {
  await act(async () => {
    await useStore.getState().openNote(`${ROOT}/CLAUDE.md`);
  });
  await tick(30);
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  act(() => root.unmount());
});

describe("G0 decisions are honoured", () => {
  it("keeps the current search (⌘P, a filter in the sidebar), not a ⌘K overlay", async () => {
    await boot();
    expect(text()).not.toContain("⌘K");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", metaKey: true, bubbles: true }));
    });
    await tick();
    const input = q<HTMLInputElement>("input[placeholder='Search Projects']");
    expect(input).not.toBeNull();
  });

  it("has no appearance button in the top bar: appearance lives in Settings", async () => {
    await boot();
    expect(q("button[aria-label='Appearance']")).toBeNull();
    act(() => useStore.getState().openSettings());
    await tick();
    click(q("[data-settings-section='appearance']"));
    await tick();
    expect(q("[data-appearance-section]")).not.toBeNull();
    expect(text()).toContain("Theme");
    expect(text()).toContain("Page tint");
    expect(text()).toContain("Page width");
  });
});

describe("G1 shell", () => {
  it("has a sidebar, a note column with a top bar and status bar, and a right panel", async () => {
    await boot();
    expect(qa("aside")).toHaveLength(2);
    expect(q("[data-breadcrumb]")).not.toBeNull();
    expect(q("footer")).not.toBeNull();
    expect(q("aside[aria-label='Inspector']")).not.toBeNull();
  });

  it("⌘\\ toggles the sidebar and ⌥⌘\\ the right panel, and each toggle moves to the top bar", async () => {
    await boot();
    key({ code: "Backslash", metaKey: true });
    expect(useStore.getState().leftOpen).toBe(false);
    expect(q("button[aria-label='Show sidebar']")).not.toBeNull();
    key({ code: "Backslash", metaKey: true, altKey: true });
    expect(useStore.getState().rightOpen).toBe(false);
    expect(q("button[aria-label='Show panel']")).not.toBeNull();
    key({ code: "Backslash", metaKey: true });
    key({ code: "Backslash", metaKey: true, altKey: true });
    expect(useStore.getState().leftOpen && useStore.getState().rightOpen).toBe(true);
  });

  it("the right panel has Outline, Context and Changes tabs", async () => {
    await boot();
    expect(qa("[role='tab']").map((t) => t.textContent)).toEqual(["Outline", "Context", "Changes"]);
  });
});

describe("G2 root and tree", () => {
  it("lays the sidebar out: search box and tree, root button with the More menu beside it at the foot, no Settings button, no FILES label", async () => {
    await boot();
    const aside = q("aside:not([aria-label])")!;
    expect(aside.textContent).not.toContain("New file");
    expect(q("input[aria-label='Search Projects']")).not.toBeNull();
    expect(aside.textContent).not.toContain("FILES");
    const rootButton = q("[data-root-button]")!;
    expect(rootButton.textContent).toContain("Projects");
    expect(rootButton.textContent).not.toContain("/Users");
    expect(rootButton.nextElementSibling?.getAttribute("aria-label")).toBe("More");
    expect(q("button[aria-label='Settings']")).toBeNull();
  });

  it("the root menu lists Go up to, Recent and Choose another folder", async () => {
    await boot({ recentRoots: ["/Users/me/Other"] });
    click(q("[data-root-button]"));
    await tick();
    const menu = q("[data-root-menu]")!;
    expect(menu.textContent).toContain("Go up to");
    expect(menu.textContent).toContain("me");
    expect(menu.textContent).toContain("Recent");
    expect(menu.textContent).toContain("Other");
    expect(menu.textContent).toContain("Choose another folder…");
  });

  it("shows files before folders, with single-child chains merged and SKILL.md folded", async () => {
    await boot();
    const paths = rowPaths();
    expect(paths.indexOf(`${ROOT}/README.md`)).toBeLessThan(paths.indexOf(`${ROOT}/docs`));
    expect(text()).toContain("Research / _feeds / 2026");
    expect(text()).toContain("pipeline / SKILL.md");
  });

  it("the chevron folds a folder without opening it; the name opens its page", async () => {
    await boot();
    const folder = row(`${ROOT}/docs`)!;
    click(folder.querySelector("button[aria-label='Expand folder']"));
    expect(useStore.getState().expanded.has(`${ROOT}/docs`)).toBe(true);
    expect(useStore.getState().folderPage).toBeNull();
    click(row(`${ROOT}/docs`)!.querySelector("span.truncate"));
    await tick();
    expect(useStore.getState().folderPage).toBe(`${ROOT}/docs`);
    expect(q("[data-folder-page]")).not.toBeNull();
  });

  it("the dots button opens Rename, Copy path for agent, Move to Trash on a file", async () => {
    await boot();
    click(row(`${ROOT}/README.md`)!.querySelector("button[aria-label='More actions']"));
    const items = qa("[role='menuitem']").map((i) => i.textContent);
    expect(items).toEqual(["Rename", "Copy path for agent", "Move to Trash"]);
  });

  it("right-clicking a folder offers New file here, Rename, Set as root folder, Move to Trash", async () => {
    await boot();
    act(() => {
      row(`${ROOT}/docs`)!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });
    expect(qa("[role='menuitem']").map((i) => i.textContent)).toEqual([
      "New file here",
      "Rename",
      "Set as root folder",
      "Move to Trash",
    ]);
  });

  it("the folder page shows the title, counts and the two buttons", async () => {
    await boot();
    await act(async () => {
      await useStore.getState().openFolder(`${ROOT}/docs`);
    });
    const page = q("[data-folder-page]")!;
    expect(page.querySelector("h1")?.textContent).toBe("docs");
    expect(page.textContent).toContain("2 items");
    expect(page.textContent).toContain("tokens in files here");
    expect(page.textContent).toContain("Set as root folder");
    expect(page.textContent).toContain("New file");
    expect(page.textContent).not.toContain("New folder");
    click(page.querySelector(`[data-folder-row="${ROOT}/docs/architecture.md"]`));
    await tick();
    expect(useStore.getState().activePath).toBe(`${ROOT}/docs/architecture.md`);
  });

  it("the folder page of the root hides Set as root folder", async () => {
    await boot();
    await act(async () => {
      await useStore.getState().openFolder(ROOT);
    });
    expect(q("[data-folder-page]")!.textContent).not.toContain("Set as root folder");
  });

  it("the breadcrumb runs from the root to the file and its folders open their pages", async () => {
    await boot();
    await act(async () => {
      await useStore.getState().openNote(`${ROOT}/docs/architecture.md`);
    });
    const crumb = q("[data-breadcrumb]")!;
    expect(crumb.textContent).toBe("Projects/docs/architecture.md");
    click(Array.from(crumb.querySelectorAll("button")).find((b) => b.textContent === "docs")!);
    await tick();
    expect(useStore.getState().folderPage).toBe(`${ROOT}/docs`);
    expect(useStore.getState().folder).toBe(ROOT);
  });

  it("a file outside the root shows its last three parts as plain text", async () => {
    await boot();
    await act(async () => {
      await useStore.getState().openNote("/Users/me/.claude/skills/x/SKILL.md");
    });
    const crumb = q("[data-breadcrumb]")!;
    expect(crumb.textContent).toBe("skills/x/SKILL.md");
    expect(crumb.querySelectorAll("button")).toHaveLength(0);
  });

  it("New file opens the new note with its name ready to type", async () => {
    await boot();
    // The new file exists on disk by the time the tree is rescanned.
    fsMock.tree = [...TREE, file("untitled.md", ROOT, 0)];
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }));
    });
    await tick(20);
    expect(useStore.getState().activePath).toBe(`${ROOT}/untitled.md`);
    expect(useStore.getState().renamingPath).toBe(`${ROOT}/untitled.md`);
    expect(q("input[aria-label='Name']")).not.toBeNull();
  });

  it("changing the root keeps the open file open", async () => {
    await boot();
    await openClaude();
    await act(async () => {
      await useStore.getState().setRoot(`${ROOT}/docs`);
    });
    expect(useStore.getState().activePath).toBe(`${ROOT}/CLAUDE.md`);
    // Now outside the root, so the breadcrumb falls back to the last three parts.
    expect(q("[data-breadcrumb]")!.textContent).toBe("me/Projects/CLAUDE.md");
  });

  it("F2 renames and ⌘⌫ trashes the selected row", async () => {
    await boot();
    const r = row(`${ROOT}/README.md`)!;
    act(() => {
      r.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true }));
    });
    expect(useStore.getState().renamingPath).toBe(`${ROOT}/README.md`);
    act(() => {
      useStore.getState().startRename(null);
    });
    act(() => {
      row(`${ROOT}/README.md`)!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Backspace", metaKey: true, bubbles: true }),
      );
    });
    await tick();
    expect(fsMock.trashed).toContain(`${ROOT}/README.md`);
  });

  it("arrow keys move between rows and never open anything", async () => {
    await boot();
    const first = row(`${ROOT}/CLAUDE.md`)!;
    act(() => {
      first.focus();
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    await tick();
    expect(useStore.getState().activePath).toBeNull();
    expect(document.activeElement?.getAttribute("data-tree-row")).toBe(`${ROOT}/README.md`);
  });
});

describe("G3 editor views", () => {
  it("has a view switch for rich text, markdown source and side by side", async () => {
    await boot();
    await openClaude();
    expect(qa("[data-view]").filter((b) => b.tagName === "BUTTON").map((b) => b.dataset.view)).toEqual([
      "rich",
      "source",
      "split",
    ]);
    click(q("button[data-view='source']"));
    await tick();
    expect(q("[data-source-pane]")).not.toBeNull();
    click(q("button[data-view='split']"));
    await tick();
    expect(q("[data-source-pane]")).not.toBeNull();
    expect(q(".tiptap")).not.toBeNull();
    click(q("button[data-view='rich']"));
    await tick();
    expect(q("[data-source-pane]")).toBeNull();
  });

  it("shows YAML frontmatter as a properties block with editable values", async () => {
    await boot();
    await openClaude();
    const props = q("[data-properties]")!;
    expect(props.textContent).toContain("description");
    expect(props.textContent).toContain("Claude Code");
    expect(props.querySelector("[data-prop-input]")).not.toBeNull();
    expect(q(".tiptap")!.textContent).not.toContain("applies to");
  });

  it("opening a note writes nothing", async () => {
    await boot();
    await openClaude();
    await tick(1300);
    expect(fsMock.writes).toEqual([]);
  });
});

describe("G4 editing", () => {
  it("pasting an image saves it into assets/ beside the note and inserts a relative link", async () => {
    await boot();
    await openClaude();
    const editorEl = q(".tiptap")!;
    const file = new File([new Uint8Array([1, 2, 3])], "Screen Shot.png", { type: "image/png" });
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { files: [file], types: ["Files"], getData: () => "", items: [] },
    });
    await act(async () => {
      editorEl.dispatchEvent(event);
    });
    await tick(30);
    expect(invoke).toHaveBeenCalledWith(
      "save_asset",
      expect.objectContaining({ filePath: `${ROOT}/CLAUDE.md`, ext: "png" }),
    );
    expect(q(".tiptap")!.innerHTML).toContain("assets/image-1.png");
  });

  it("the selection toolbar offers bold, italic, strikethrough, code and link", async () => {
    const { SelectionToolbar } = await import("./components/SelectionToolbar");
    const calls: string[] = [];
    const handlers = new Map<string, () => void>();
    const chain: Record<string, () => unknown> = {};
    for (const name of ["focus", "toggleBold", "toggleItalic", "toggleStrike", "toggleCode", "run"]) {
      chain[name] = () => {
        calls.push(name);
        return chain;
      };
    }
    const fake = {
      state: { selection: { from: 1, to: 5, empty: false } },
      isActive: () => false,
      isFocused: true,
      getAttributes: () => ({}),
      view: { coordsAtPos: () => ({ left: 100, top: 100 }) },
      on: (n: string, fn: () => void) => handlers.set(n, fn),
      off: () => {},
      chain: () => chain,
      commands: { focus: () => {} },
    };
    const host = document.createElement("div");
    document.body.append(host);
    const r = createRoot(host);
    await act(async () => {
      r.render(<SelectionToolbar editor={fake as never} />);
    });
    await act(async () => {
      handlers.get("selectionUpdate")?.();
    });
    const buttons = Array.from(host.querySelectorAll<HTMLElement>("[data-format]"));
    expect(buttons.map((b) => b.dataset.format)).toEqual(["bold", "italic", "strike", "code", "link"]);
    click(buttons[0]);
    expect(calls).toContain("toggleBold");
    act(() => r.unmount());
  });

  it("the slash menu offers Table, Task list and Code block", async () => {
    const { slashItems } = await import("./editor/slashItems");
    expect(slashItems.map((i) => i.title)).toEqual(["Table", "Task list", "Code block"]);
  });
});

describe("G5 tokens and the right panel", () => {
  it("the status bar shows the save state and the file type on the right", async () => {
    await boot();
    await openClaude();
    expect(q("[data-slot='right']")!.textContent).toContain("Markdown");
    act(() => useStore.setState({ status: "saved" }));
    expect(q("[data-slot='right']")!.textContent).toBe("SavedMarkdown");
    act(() => useStore.setState({ status: "saving" }));
    expect(q("[data-slot='right']")!.textContent).toContain("Saving…");
  });

  it("the status bar shows tokens (characters / 3.5) and words", async () => {
    await boot();
    await openClaude();
    const tokens = q("[data-tokens]")!.textContent!;
    expect(tokens).toBe(`≈ ${Math.round(CLAUDE.length / 3.5).toLocaleString("en-US")} tokens`);
    expect(q("[data-words]")!.textContent).toMatch(/\d+ words/);
  });

  it("the Outline lists headings with tokens and the Checks name their sections", async () => {
    await boot();
    await openClaude();
    await tick(400);
    const items = qa("[data-outline-item]");
    expect(items.map((i) => i.querySelector("span")?.textContent)).toEqual([
      "Agent guide",
      "Build and run",
      "Testing rules",
    ]);
    expect(items.every((i) => /\d/.test(i.querySelector("em")?.textContent ?? ""))).toBe(true);
    const checks = qa("[data-check]").map((c) => c.textContent);
    expect(checks).toContain("Broken link to docs/setup.mdAgent guide");
    expect(checks).toContain("Image has no alt textBuild and run");
    expect(checks.some((c) => c.includes("architecture"))).toBe(false);
  });

  it("clicking an outline entry asks the editor to scroll to the heading", async () => {
    await boot();
    await openClaude();
    await tick(50);
    const before = useStore.getState().headingRequest.n;
    click(qa("[data-outline-item]")[1]);
    expect(useStore.getState().headingRequest.n).toBe(before + 1);
    expect(useStore.getState().headingRequest.index).toBe(1);
  });

  it("the Context tab shows this file, linked files, the total, backlinks and the path", async () => {
    await boot();
    await openClaude();
    click(q("[data-tab='context']"));
    await tick(80);
    expect(q("[data-context-own]")).not.toBeNull();
    expect(qa("[data-context-linked]").map((e) => e.textContent)).toEqual([
      expect.stringContaining("architecture.md"),
    ]);
    const own = Math.round(CLAUDE.length / 3.5);
    const linked = Math.round(TEXTS[`${ROOT}/docs/architecture.md`].length / 3.5);
    expect(q("[data-context-total]")!.textContent).toBe(`≈ ${(own + linked).toLocaleString("en-US")}`);
    expect(qa("[data-context-backlink]").map((e) => e.textContent)).toEqual(["README.md"]);
    expect(text()).toContain(`${ROOT}/CLAUDE.md`);
  });
});

describe("G6 changes", () => {
  it("watches the root folder", async () => {
    const fs = await import("./lib/fs");
    await boot();
    expect(fs.startWatch).toHaveBeenCalledWith(ROOT);
  });

  const edited = CLAUDE.replace("Run tests.", "Run all tests.\nThen lint.");

  it("an outside edit shows a tree dot, a status notice and a Changes tab diff", async () => {
    await boot();
    await openClaude();
    TEXTS[`${ROOT}/CLAUDE.md`] = edited;
    await act(async () => {
      await useStore.getState().handleFsChange([`${ROOT}/CLAUDE.md`]);
    });
    await tick(30);
    expect(row(`${ROOT}/CLAUDE.md`)!.querySelector("[data-changed-dot]")).not.toBeNull();
    expect(q("[data-change-notice]")!.textContent).toMatch(/Changed on disk .* · 2 lines added, 1 line removed/);
    click(q("[data-review-diff]"));
    await tick();
    expect(useStore.getState().rightTab).toBe("changes");
    expect(qa("[data-diff-line='add']").map((l) => l.textContent)).toEqual(["+ Run all tests.", "+ Then lint."]);
    expect(qa("[data-diff-line='del']").map((l) => l.textContent)).toEqual(["− Run tests."]);
    TEXTS[`${ROOT}/CLAUDE.md`] = CLAUDE;
  });

  it("Keep change clears the dot and the notice", async () => {
    await boot();
    await openClaude();
    TEXTS[`${ROOT}/CLAUDE.md`] = edited;
    await act(async () => {
      await useStore.getState().handleFsChange([`${ROOT}/CLAUDE.md`]);
    });
    click(q("[data-tab='changes']"));
    await tick();
    click(q("[data-keep-change]"));
    await tick();
    expect(q("[data-change-notice]")).toBeNull();
    expect(row(`${ROOT}/CLAUDE.md`)!.querySelector("[data-changed-dot]")).toBeNull();
    TEXTS[`${ROOT}/CLAUDE.md`] = CLAUDE;
  });

  it("Revert puts the earlier text back on disk", async () => {
    await boot();
    await openClaude();
    TEXTS[`${ROOT}/CLAUDE.md`] = edited;
    await act(async () => {
      await useStore.getState().handleFsChange([`${ROOT}/CLAUDE.md`]);
    });
    click(q("[data-tab='changes']"));
    await tick();
    click(q("[data-revert-change]"));
    await tick();
    expect(fsMock.writes).toEqual([[`${ROOT}/CLAUDE.md`, CLAUDE]]);
    expect(q("[data-change-notice]")).toBeNull();
    TEXTS[`${ROOT}/CLAUDE.md`] = CLAUDE;
  });
});

describe("G7 trash, copy, settings", () => {
  it("Settings opens with the button and ⌘, and has Files and Appearance", async () => {
    await boot();
    key({ key: ",", metaKey: true });
    await tick();
    expect(q("[data-settings]")).not.toBeNull();
    expect(qa("[data-settings-section]").map((b) => b.dataset.settingsSection)).toEqual(["files", "appearance"]);
    expect(text()).toContain("Start folder");
  });

  it("the hidden-files toggle lives in Settings, off by default", async () => {
    await boot();
    act(() => useStore.getState().openSettings());
    await tick();
    const toggle = q("[data-hidden-toggle]")!;
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await act(async () => {
      toggle.click();
    });
    await tick();
    expect(useStore.getState().showHidden).toBe(true);
    expect(localStorage.getItem("monocle:showHidden")).toBe("1");
  });

  it("Copy for agent offers the path reference, full contents and current section", async () => {
    await boot({ home: HOME });
    await openClaude();
    click(q("[data-copy-button]"));
    await tick(30);
    const menu = q("[data-copy-menu]")!;
    expect(menu.textContent).toContain("Path reference");
    expect(menu.textContent).toContain("@CLAUDE.md");
    expect(menu.textContent).toContain("Full contents");
    expect(menu.textContent).toContain("Current section");
    const items = Array.from(menu.querySelectorAll("button"));
    click(items[0]);
    await tick();
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("@CLAUDE.md");
    click(q("[data-copy-button]"));
    click(Array.from(q("[data-copy-menu]")!.querySelectorAll("button"))[1]);
    await tick();
    const written = vi.mocked(navigator.clipboard.writeText).mock.calls.slice(-1)[0][0];
    expect(written.startsWith('<file name="CLAUDE.md">')).toBe(true);
  });

  it("Copy current section copies the heading the cursor is under, to the next of its level", async () => {
    const { setCursorHeadingProvider } = await import("./lib/editorBuffer");
    await boot({ home: HOME });
    await openClaude();
    setCursorHeadingProvider(() => 1);
    click(q("[data-copy-button]"));
    await tick(20);
    expect(q("[data-copy-menu]")!.textContent).toContain("Build and run");
    click(Array.from(q("[data-copy-menu]")!.querySelectorAll("button"))[2]);
    await tick();
    const written = vi.mocked(navigator.clipboard.writeText).mock.calls.slice(-1)[0][0];
    expect(written).toBe("## Build and run\n\nUse pnpm.\n\n![](assets/x.png)");
  });

  it("Move to Trash sends a file to the Trash straight away", async () => {
    await boot();
    await act(async () => {
      await useStore.getState().trashEntry(`${ROOT}/README.md`);
    });
    expect(fsMock.trashed).toEqual([`${ROOT}/README.md`]);
  });

  it("Move to Trash on a folder with files asks first, naming the count", async () => {
    await boot();
    let done: Promise<void>;
    await act(async () => {
      done = useStore.getState().trashEntry(`${ROOT}/docs`);
    });
    await tick();
    expect(q(".modal-card")!.textContent).toContain("2 files");
    expect(fsMock.trashed).toEqual([]);
    click(Array.from(qa("button")).find((b) => b.textContent === "Move to Trash" && b.classList.contains("modal-btn"))!);
    await act(async () => {
      await done;
    });
    expect(fsMock.trashed).toEqual([`${ROOT}/docs`]);
  });
});

describe("sidebar search", () => {
  it("has no sort button", async () => {
    await boot();
    expect(q("[data-sort-button]")).toBeNull();
  });
});

describe("window chrome", () => {
  it("reserves the traffic lights' room in a div of its own", async () => {
    await boot();
    const slot = q("[data-traffic-lights]") as HTMLElement;
    expect(slot).not.toBeNull();
    expect(slot.style.width).toBe("72px");
    expect(slot.style.height).toBe("40px");
  });

  it("keeps the traffic lights centred on the 40px top row", async () => {
    const { TOP_ROW_HEIGHT, TRAFFIC_LIGHT_OFFSET } = await import("./lib/layout");
    const files = import.meta.glob("../src-tauri/tauri.conf.json", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const conf = JSON.parse(Object.values(files)[0]);
    const y = conf.app.windows[0].trafficLightPosition.y;
    expect(y).toBe(TOP_ROW_HEIGHT / 2 + TRAFFIC_LIGHT_OFFSET);
    // The three top rows all use the same height class.
    for (const name of ["Sidebar", "TopBar", "RightPanel"]) {
      const src = (
        Object.values(
          import.meta.glob("./components/*.tsx", { query: "?raw", import: "default", eager: true }),
        ) as string[]
      ).find((_text, i) => Object.keys(import.meta.glob("./components/*.tsx"))[i].endsWith(`/${name}.tsx`));
      expect(src).toContain("relative flex h-10");
    }
  });
});

describe("first launch", () => {
  it("opens the home folder as root and selects the first markdown file", async () => {
    await boot();
    localStorage.removeItem("monocle:lastFolder");
    useStore.setState({ folder: null, tree: [], notes: [], activePath: null });
    await act(async () => {
      await useStore.getState().init();
    });
    const state = useStore.getState();
    expect(state.folder).toBe(state.home);
    expect(state.activePath).toBe(state.notes[0].path);
    expect(state.activePath).not.toBeNull();
    // From then on the app returns to where it was left, without re-picking.
    expect(localStorage.getItem("monocle:lastFolder")).toBe(state.home);
  });
});
