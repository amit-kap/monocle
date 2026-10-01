import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({ confirm: vi.fn(async () => true) }));
vi.mock("@tauri-apps/api/path", () => ({ dirname: vi.fn() }));
vi.mock("../lib/fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/fs")>();
  return {
    ...actual,
    readTree: vi.fn(async () => []),
    readNote: vi.fn(async () => "original"),
    renameNoteFile: vi.fn(async () => "/notes/Renamed.md"),
  };
});

const { useStore } = await import("./useStore");

describe("useStore", () => {
  beforeEach(() => {
    useStore.setState({ folder: "/notes", status: "idle", activePath: null });
  });

  it("bumps loadId when a note is opened", async () => {
    const before = useStore.getState().loadId;
    await useStore.getState().openNote("/notes/A.md");
    expect(useStore.getState().loadId).toBe(before + 1);
  });

  it("renaming the open note keeps the loaded buffer and dirty state", async () => {
    await useStore.getState().openNote("/notes/A.md");
    useStore.getState().markDirty();
    const { loadId } = useStore.getState();

    await useStore.getState().renameNote("/notes/A.md", "Renamed");

    const state = useStore.getState();
    expect(state.activePath).toBe("/notes/Renamed.md");
    expect(state.loadId).toBe(loadId);
    expect(state.status).toBe("dirty");
  });
});
