import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Sidebar } from "./components/Sidebar";
import { EditorPane } from "./components/EditorPane";
import { useStore } from "./store/useStore";

function App() {
  const init = useStore((s) => s.init);
  const createNote = useStore((s) => s.createNote);
  const notes = useStore((s) => s.notes);
  const activePath = useStore((s) => s.activePath);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createNote();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNote]);

  useEffect(() => {
    const name = notes.find((note) => note.path === activePath)?.name;
    void getCurrentWindow().setTitle(name ? `${name} — Monocle` : "Monocle");
  }, [activePath, notes]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (useStore.getState().status !== "dirty") return;
        const discard = await confirm(
          "You have unsaved changes. Quit without saving?",
          { title: "Unsaved changes", kind: "warning" },
        );
        if (!discard) event.preventDefault();
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <Sidebar />
      <EditorPane />
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
