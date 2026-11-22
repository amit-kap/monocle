import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: vi.fn(),
  exists: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  writeTextFile: vi.fn(),
  stat: vi.fn(async () => ({ size: 1400 })),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
const invokeMock = vi.hoisted(() => vi.fn(async (_cmd: string, _args?: unknown) => undefined as unknown));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/path", () => ({
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
  dirname: vi.fn(async (p: string) => p.slice(0, p.lastIndexOf("/"))),
}));

const { readTree } = await import("./fs");
const pluginFs = await import("@tauri-apps/plugin-fs");
const readDir = vi.mocked(pluginFs.readDir);

// What the tree holds (every folder, only markdown, which hidden folders show)
// is decided natively and tested in src-tauri/src/tree.rs.
describe("readTree", () => {
  it("reads the tree through the native scan_tree command", async () => {
    invokeMock.mockClear();
    invokeMock.mockResolvedValueOnce([{ name: "a.md", path: "/notes/a.md", kind: "file" }]);
    const nodes = await readTree("/notes", true);
    expect(invokeMock).toHaveBeenCalledWith("scan_tree", { root: "/notes", showHidden: true });
    expect(nodes.map((n) => n.name)).toEqual(["a.md"]);
  });
});

describe("sortNodes", () => {
  it("puts files before folders, each A to Z", async () => {
    const { sortNodes } = await import("./fs");
    const sorted = sortNodes([
      { name: "zeta", path: "/z", kind: "dir" },
      { name: "b.md", path: "/b.md", kind: "file" },
      { name: "alpha", path: "/a", kind: "dir" },
      { name: "a.md", path: "/a.md", kind: "file" },
    ]);
    expect(sorted.map((n) => n.name)).toEqual(["a.md", "b.md", "alpha", "zeta"]);
  });
});


describe("the plan's file rules", () => {
  beforeEach(() => {
    readDir.mockClear();
    invokeMock.mockClear();
  });

  it("writes through the atomic Rust command, never a plain write", async () => {
    const { writeNote } = await import("./fs");
    await writeNote("/notes/a.md", "text\n");
    expect(invokeMock).toHaveBeenCalledWith("write_file_atomic", { path: "/notes/a.md", contents: "text\n" });
  });

  it("names new files untitled.md, then untitled 2.md", async () => {
    const { createNoteFile } = await import("./fs");
    const pluginFs = await import("@tauri-apps/plugin-fs");
    const exists = vi.mocked(pluginFs.exists);
    exists.mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await createNoteFile("/notes")).toBe("/notes/untitled 2.md");
    exists.mockReset();
    exists.mockResolvedValue(false);
    expect(await createNoteFile("/notes")).toBe("/notes/untitled.md");
  });

  it("makes new folders named untitled folder, with a number when taken", async () => {
    const { createDirectory } = await import("./fs");
    const pluginFs = await import("@tauri-apps/plugin-fs");
    const exists = vi.mocked(pluginFs.exists);
    exists.mockReset();
    exists.mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await createDirectory("/notes")).toBe("/notes/untitled folder 2");
    expect(invokeMock).toHaveBeenCalledWith("create_dir", { path: "/notes/untitled folder 2" });
  });

  it("moves to the system Trash through the Rust command", async () => {
    const { trashPath } = await import("./fs");
    await trashPath("/notes/a.md");
    expect(invokeMock).toHaveBeenCalledWith("trash_path", { path: "/notes/a.md" });
  });

  it("saves pasted images through save_asset", async () => {
    const { saveAsset } = await import("./fs");
    await saveAsset("/notes/a.md", [1, 2], "png");
    expect(invokeMock).toHaveBeenCalledWith("save_asset", { filePath: "/notes/a.md", bytes: [1, 2], ext: "png" });
  });
});

describe("filterTree", () => {
  const tree = [
    {
      name: "CompLibs",
      path: "/p/CompLibs",
      kind: "dir" as const,
      children: [
        {
          name: "glaze",
          path: "/p/CompLibs/glaze",
          kind: "dir" as const,
          children: [{ name: "README.md", path: "/p/CompLibs/glaze/README.md", kind: "file" as const }],
        },
      ],
    },
    { name: "notes.md", path: "/p/notes.md", kind: "file" as const },
  ];

  it("matches a file by name", async () => {
    const { filterTree } = await import("./fs");
    expect(filterTree(tree, "notes").map((n) => n.name)).toEqual(["notes.md"]);
  });

  it("matches a folder by name and keeps everything inside it", async () => {
    const { filterTree } = await import("./fs");
    const [top] = filterTree(tree, "glaze");
    expect(top.name).toBe("CompLibs");
    expect(top.children?.[0].name).toBe("glaze");
    expect(top.children?.[0].children?.[0].name).toBe("README.md");
  });
});

describe("filterTree with places", () => {
  it("keeps a place only while something in it matches, whatever its name", async () => {
    const { filterTree } = await import("./fs");
    const tree = [
      {
        name: "notes",
        path: "/notes",
        kind: "dir" as const,
        place: true,
        children: [{ name: "plan.md", path: "/notes/plan.md", kind: "file" as const }],
      },
    ];
    expect(filterTree(tree, "notes")).toEqual([]);
    expect(filterTree(tree, "plan")[0].children?.map((n) => n.name)).toEqual(["plan.md"]);
  });
});
