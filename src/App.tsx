import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar";
import { EditorPane } from "./components/EditorPane";
import { SettingsModal } from "./components/SettingsModal";
import { ModalHost } from "./components/ModalHost";
import { FolderPage } from "./components/FolderPage";
import { TopBar } from "./components/TopBar";
import { RightPanel } from "./components/RightPanel";
import { StatusBar } from "./components/StatusBar";
import { bufferMarkdown } from "./lib/editorBuffer";
import { useStore } from "./store/useStore";
import {
  DISMISS,
  askUnsavedChanges,
  useModalPrompt,
} from "./store/useModalPrompt";

function App() {
  const init = useStore((s) => s.init);
  const createNote = useStore((s) => s.createNote);
  const notes = useStore((s) => s.notes);
  const activePath = useStore((s) => s.activePath);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  const folderPage = useStore((s) => s.folderPage);
  const toggleLeft = useStore((s) => s.toggleLeft);
  const toggleRight = useStore((s) => s.toggleRight);

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

  // Outside edits to markdown under the root arrive from the file watcher.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen<string[]>("fs-change", (event) => {
      void useStore.getState().handleFsChange(event.payload);
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {
        // not running under Tauri
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        const state = useStore.getState();
        if (state.settingsOpen) state.closeSettings();
        else state.openSettings();
        return;
      }
      // ⌘\ hides the sidebar, ⌥⌘\ the right panel. `code`, not `key`: with
      // Option held, macOS reports a different character for the backslash.
      if ((event.metaKey || event.ctrlKey) && event.code === "Backslash") {
        event.preventDefault();
        if (event.altKey) toggleRight();
        else toggleLeft();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        // The unsaved-changes prompt owns the keyboard while it is open.
        if (useModalPrompt.getState().pending) return;
        event.preventDefault();
        void createNote();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNote, toggleLeft, toggleRight]);

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
        if (choice === DISMISS) return;
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

  // The sidebar runs to the top of the window, so the traffic lights sit over
  // it and each column carries its own top row: the sidebar's actions on the
  // left, the note's toolbar on the right.
  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <Sidebar />
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <TopBar />
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          style={{ display: folderPage ? "none" : undefined }}
        >
          <EditorPane />
        </div>
        {folderPage && <FolderPage />}
        <StatusBar />
      </div>
      <RightPanel />
      <ModalHost />
      <SettingsModal />
      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="absolute bottom-3 right-3 max-w-[420px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-menu)] px-3 py-2 text-left text-[12px] text-[var(--danger)] shadow-[var(--shadow-menu)]"
        >
          {error}
        </button>
      )}
    </div>
  );
}

export default App;
