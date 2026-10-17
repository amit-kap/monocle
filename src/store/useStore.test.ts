import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/path", () => ({ dirname: vi.fn() }));
vi.mock("../lib/fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/fs")>();
  return {
    ...actual,
    readTree: vi.fn(async () => []),
    readNote: vi.fn(async () => "original"),
    writeNote: vi.fn(async () => {}),
    renameNoteFile: vi.fn(async () => "/notes/Renamed.md"),
  };
});

const { useStore } = await import("./useStore");
const { answerUnsavedChanges, useUnsavedPrompt } = await import(
  "./useUnsavedPrompt"
);
const { setBufferSerializer } = await import("../lib/editorBuffer");
const fs = await import("../lib/fs");
const readTree = vi.mocked(fs.readTree);
const writeNote = vi.mocked(fs.writeNote);

/** Every describe starts from a clean, prompt-free store. */
function resetStore(): void {
  readTree.mockClear();
  writeNote.mockClear();
  useUnsavedPrompt.setState({ pending: null });
  setBufferSerializer(null);
  useStore.setState({
    folder: "/notes",
    notes: [],
    tree: [],
    expanded: new Set<string>(),
    activePath: null,
    activeContent: "",
    status: "idle",
    error: null,
  });
}

describe("useStore", () => {
  beforeEach(resetStore);

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

  it("rescans when 'Open With' names a file the list doesn't know", async () => {
    readTree.mockResolvedValueOnce([
      { name: "New.md", path: "/notes/New.md", kind: "file" },
    ]);

    await useStore.getState().openExternalNote("/notes/New.md");

    expect(useStore.getState().notes).toEqual([
      { name: "New.md", path: "/notes/New.md" },
    ]);
    expect(useStore.getState().activePath).toBe("/notes/New.md");
  });

  it("opens a known file without rescanning", async () => {
    useStore.setState({
      notes: [{ name: "A.md", path: "/notes/A.md" }],
    });

    await useStore.getState().openExternalNote("/notes/A.md");

    expect(readTree).not.toHaveBeenCalled();
    expect(useStore.getState().activePath).toBe("/notes/A.md");
  });
});

describe("switching notes with unsaved edits", () => {
  beforeEach(async () => {
    resetStore();
    await useStore.getState().openNote("/notes/A.md");
    useStore.getState().markDirty();
  });

  it("asks, naming the note that has the edits", async () => {
    const switching = useStore.getState().openNote("/notes/B.md");
    expect(useUnsavedPrompt.getState().pending?.note).toBe("A.md");
    answerUnsavedChanges("discard");
    await switching;
  });

  it("stays on the note when the user keeps editing", async () => {
    const switching = useStore.getState().openNote("/notes/B.md");
    answerUnsavedChanges("cancel");
    await switching;
    expect(useStore.getState().activePath).toBe("/notes/A.md");
  });

  it("switches and drops the edits on discard", async () => {
    const switching = useStore.getState().openNote("/notes/B.md");
    answerUnsavedChanges("discard");
    await switching;
    expect(useStore.getState().activePath).toBe("/notes/B.md");
    expect(writeNote).not.toHaveBeenCalled();
  });

  it("writes the buffer first when the user saves", async () => {
    setBufferSerializer(() => "edited body");
    const switching = useStore.getState().openNote("/notes/B.md");
    answerUnsavedChanges("save");
    await switching;

    expect(writeNote).toHaveBeenCalledWith("/notes/A.md", "edited body");
    expect(useStore.getState().activePath).toBe("/notes/B.md");
  });

  it("keeps the note open when saving fails, rather than losing the edits", async () => {
    writeNote.mockRejectedValueOnce(new Error("disk full"));
    setBufferSerializer(() => "edited body");

    const switching = useStore.getState().openNote("/notes/B.md");
    answerUnsavedChanges("save");
    await switching;

    expect(useStore.getState().activePath).toBe("/notes/A.md");
    expect(useStore.getState().status).toBe("error");
  });

  it("keeps the note open when there is no buffer to save", async () => {
    const switching = useStore.getState().openNote("/notes/B.md");
    answerUnsavedChanges("save");
    await switching;

    expect(useStore.getState().activePath).toBe("/notes/A.md");
    expect(writeNote).not.toHaveBeenCalled();
  });
});

describe("switching without unsaved edits", () => {
  beforeEach(resetStore);

  it("does not ask", async () => {
    await useStore.getState().openNote("/notes/A.md");
    await useStore.getState().openNote("/notes/B.md");
    expect(useUnsavedPrompt.getState().pending).toBeNull();
    expect(useStore.getState().activePath).toBe("/notes/B.md");
  });
});
