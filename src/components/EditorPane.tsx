import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useStore } from "../store/useStore";
import { toMarkdown } from "../lib/markdown";
import { stripExt } from "../lib/fs";
import {
  CONTENT,
  columnEdgeLeft,
  widthFromDrag,
  type ColumnSide,
} from "../lib/layout";
import { appExtensions } from "../editor/extensions";
import { setImageBaseDir } from "../editor/extensions/LocalImages";
import { setBufferSerializer } from "../lib/editorBuffer";
import { noteDir } from "../lib/imagePath";
import { loadDocument } from "../editor/loadDocument";
import { BlockHandles } from "./BlockHandles";
import { CodeBlockLanguage } from "./CodeBlockLanguage";
import { ResizeHandle } from "./ResizeHandle";

// How long the editor waits after the last keystroke before saving.
const AUTOSAVE_DELAY = 800;

export function EditorPane() {
  const notes = useStore((s) => s.notes);
  const activePath = useStore((s) => s.activePath);
  const loadId = useStore((s) => s.loadId);
  const markDirty = useStore((s) => s.markDirty);
  const save = useStore((s) => s.save);
  const renameNote = useStore((s) => s.renameNote);

  const [editorDom, setEditorDom] = useState<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  // The width lives in the store: the column's drag handles and the appearance
  // popover's slider are two controls over the same value.
  const contentWidth = useStore((s) => s.contentWidth);
  const setContentWidth = useStore((s) => s.setContentWidth);
  const tint = useStore((s) => s.tint);

  function startColumnResize(side: ColumnSide, event: ReactMouseEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = contentWidth;

    function onMove(moveEvent: MouseEvent) {
      const next = widthFromDrag(startWidth, moveEvent.clientX - startX, side);
      setContentWidth(next);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const activeNote = notes.find((note) => note.path === activePath);
  const baseName = activeNote ? stripExt(activeNote.name) : "";
  const [title, setTitle] = useState(baseName);

  useEffect(() => {
    setTitle(baseName);
  }, [activePath, baseName]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title, baseName, activePath]);

  function commitTitle() {
    if (!activePath) return;
    const next = title.trim();
    if (!next || next === baseName) {
      setTitle(baseName);
      return;
    }
    void renameNote(activePath, next);
  }

  // Autosave is a safety net, not a replacement: ⌘S still saves on demand, and
  // the unsaved-changes prompt only surfaces edits made inside this window.
  const saveTimer = useRef<number | null>(null);

  function cancelAutosave() {
    if (saveTimer.current === null) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
  }

  function scheduleAutosave() {
    cancelAutosave();
    // Keyed on loadId, not the path: a rename keeps the buffer, so a pending
    // save must follow it to the new name instead of being dropped.
    const { activePath, loadId } = useStore.getState();
    if (!activePath) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      const state = useStore.getState();
      // The note may have been closed or replaced while we waited.
      if (!editor || !state.activePath || state.loadId !== loadId) return;
      void state.save(toMarkdown(editor));
    }, AUTOSAVE_DELAY);
  }

  useEffect(() => cancelAutosave, []);

  const editor = useEditor({
    extensions: appExtensions,
    content: "",
    editorProps: { attributes: { class: "tiptap", spellcheck: "true" } },
    onUpdate: () => {
      markDirty();
      scheduleAutosave();
    },
  });

  useEffect(() => {
    // Keyed on loadId, not activePath: renaming the open note must not
    // replace the buffer with the content loaded when it was opened.
    const { activePath, activeContent } = useStore.getState();
    if (!editor || !activePath) return;
    cancelAutosave();
    loadDocument(editor, activeContent);
    // Deliberately no focus() here: keeping the caret out of the note means
    // arrow keys keep working in whatever the user had focused — the sidebar
    // tree, say. Opens that do want the caret (⌘N, ⌘P, a file from outside)
    // ask for it through the store.
    const scroller = editorDom?.closest(".editor-scroll") as HTMLElement | null;
    if (!scroller) return;
    scroller.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      scroller.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [editor, loadId, editorDom]);

  const editorFocusRequest = useStore((s) => s.editorFocusRequest);

  useEffect(() => {
    if (!editorFocusRequest) return;
    // ProseMirror focuses with preventScroll, so this doesn't jump the view.
    editor?.commands.focus("start", { scrollIntoView: false });
  }, [editor, editorFocusRequest]);

  useEffect(() => {
    // Relative image paths in a note are relative to the note's own folder.
    setImageBaseDir(noteDir(activePath));
  }, [activePath]);

  useEffect(() => {
    // Let the unsaved-changes prompt save this buffer on the user's behalf.
    if (!editor) return;
    setBufferSerializer(() => toMarkdown(editor));
    return () => setBufferSerializer(null);
  }, [editor]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editor && activePath) void save(toMarkdown(editor));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, activePath, save]);

  return (
    <main
      data-tint={tint}
      className="page relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]"
    >
      {activePath ? (
        <>
          {/* The page itself: the writing column's tint, full bleed — it runs
              from the titlebar to the bottom edge and rounds nothing. The
              handles' hairlines are the only edges it shows. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 bg-[var(--page)]"
            style={{
              left: columnEdgeLeft(contentWidth, "left"),
              width: contentWidth,
            }}
          />
          {(["left", "right"] as const).map((side) => (
            <ResizeHandle
              key={side}
              style={{ left: columnEdgeLeft(contentWidth, side) }}
              onResizeStart={(event) => startColumnResize(side, event)}
              onReset={() => setContentWidth(CONTENT.default)}
            />
          ))}
          <div className="editor-scroll relative flex-1 overflow-y-auto">
            <div
              /* 40px top and bottom, 64px each side: the frame's column. */
              className="mx-auto w-full px-16 py-10"
              style={{ maxWidth: contentWidth }}
            >
              <textarea
                ref={titleRef}
                value={title}
                rows={1}
                onChange={(event) => setTitle(event.currentTarget.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    // Hand the caret back to the body, where it was last —
                    // not to the first line, and not to nothing at all.
                    if (editor) editor.commands.focus();
                    else event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    setTitle(baseName);
                  }
                }}
                placeholder="Untitled"
                spellCheck={false}
                className="doc-title"
              />
              <div ref={setEditorDom}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid flex-1 place-items-center">
          <div className="text-center">
            <p className="text-[15px] text-[var(--text-muted)]">
              Select a note to start writing
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-faint)]">
              or press ⌘N for a new note
            </p>
          </div>
        </div>
      )}

      <BlockHandles editor={editor} editorDom={editorDom} />
      <CodeBlockLanguage editor={editor} editorDom={editorDom} />
    </main>
  );
}
