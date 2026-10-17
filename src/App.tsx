import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar";
import { EditorPane } from "./components/EditorPane";
import { ThemeSelector } from "./components/ThemeSelector";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { bufferMarkdown } from "./lib/editorBuffer";
import { useStore } from "./store/useStore";
import {
  askUnsavedChanges,
  useUnsavedPrompt,
} from "./store/useUnsavedPrompt";

function App() {
  const init = useStore((s) => s.init);
  const createNote = useStore((s) => s.createNote);
  const notes = useStore((s) => s.notes);
  const activePath = useStore((s) => s.activePath);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        unlisten = await listen<string[]>("open-file", (event) => {
          const paths = event.payload;
          if (paths.length > 0) {
            void useStore.getState().openExternalNote(paths[paths.length - 1]);
          }
        });
        await init();
        if (!cancelled) await invoke("frontend_ready");
      } catch {
        // not running under Tauri
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [init]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        // The unsaved-changes prompt owns the keyboard while it is open.
        if (useUnsavedPrompt.getState().pending) return;
        event.preventDefault();
        void createNote();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNote]);

  const activeName = notes.find((note) => note.path === activePath)?.name ?? null;

  useEffect(() => {
    void getCurrentWindow().setTitle(activeName ?? "Monocle");
  }, [activeName]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let answered = false;
    const appWindow = getCurrentWindow();
    void appWindow
      .onCloseRequested(async (event) => {
        // Second pass, after the user picked save or discard: let it close.
        if (answered) return;
        const { status, activePath, save } = useStore.getState();
        if (status !== "dirty") return;
        // Hold the window open before awaiting the prompt; the callback returns
        // to Rust long before the user answers.
        event.preventDefault();
        const choice = await askUnsavedChanges(
          activePath?.split(/[\\/]/).pop() ?? null,
        );
        if (choice === "cancel") return;
        if (choice === "save") {
          const markdown = bufferMarkdown();
          if (markdown === null) return;
          await save(markdown);
          if (useStore.getState().status === "error") return;
        }
        answered = true;
        await appWindow.destroy();
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  return (
    <div className="relative flex h-full w-full overflow-hidden pt-9">
      <div
        data-tauri-drag-region
        className="absolute inset-x-0 top-0 z-30 flex h-9 items-center justify-center border-b border-[var(--border)]"
      >
        <span className="pointer-events-none max-w-[60%] truncate text-[13px] font-medium text-[var(--text-muted)]">
          {activeName ?? "Monocle"}
        </span>
      </div>
      <div className="absolute right-3 top-0 z-40 flex h-9 items-center">
        <ThemeSelector />
      </div>
      <Sidebar />
      <EditorPane />
      <UnsavedChangesDialog />
      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="absolute bottom-3 right-3 max-w-[420px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left text-[12px] text-[var(--text)] shadow-lg"
        >
          {error}
        </button>
      )}
    </div>
  );
}

export default App;
