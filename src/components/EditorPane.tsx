import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useStore } from "../store/useStore";
import { toMarkdown } from "../lib/markdown";
import { stripExt } from "../lib/fs";
import {
  CONTENT,
  clampWidth,
  columnEdgeLeft,
  readWidth,
  storeWidth,
  widthFromDrag,
  type ColumnSide,
} from "../lib/layout";
import { appExtensions } from "../editor/extensions";
import { setImageBaseDir } from "../editor/extensions/LocalImages";
import { setBufferSerializer } from "../lib/editorBuffer";
import { noteDir } from "../lib/imagePath";
import { loadDocument } from "../editor/loadDocument";
import { BlockHandles } from "./BlockHandles";
import { ResizeHandle } from "./ResizeHandle";
import type { SaveStatus } from "../types";

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function EditorPane() {
  const notes = useStore((s) => s.notes);
  const activePath = useStore((s) => s.activePath);
  const loadId = useStore((s) => s.loadId);
  const status = useStore((s) => s.status);
  const markDirty = useStore((s) => s.markDirty);
  const save = useStore((s) => s.save);
  const renameNote = useStore((s) => s.renameNote);

  const [editorDom, setEditorDom] = useState<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [contentWidth, setContentWidth] = useState(() =>
    readWidth(CONTENT, localStorage),
  );

  useEffect(() => {
    storeWidth(CONTENT, localStorage, contentWidth);
  }, [contentWidth]);

  function startColumnResize(side: ColumnSide, event: ReactMouseEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = contentWidth;

    function onMove(moveEvent: MouseEvent) {
      const next = widthFromDrag(startWidth, moveEvent.clientX - startX, side);
      setContentWidth(clampWidth(next, CONTENT.min, CONTENT.max));
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

  const editor = useEditor({
    extensions: appExtensions,
    content: "",
    editorProps: { attributes: { class: "tiptap" } },
    onUpdate: () => markDirty(),
  });

  useEffect(() => {
    // Keyed on loadId, not activePath: renaming the open note must not
    // replace the buffer with the content loaded when it was opened.
    const { activePath, activeContent } = useStore.getState();
    if (!editor || !activePath) return;
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
    <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      {activePath && (
        <span className="pointer-events-none absolute right-4 top-3 z-10 text-[12px] text-[var(--text-faint)]">
          {STATUS_LABEL[status]}
        </span>
      )}

      {activePath ? (
        <>
          {(["left", "right"] as const).map((side) => (
            <ResizeHandle
              key={side}
              style={{ left: columnEdgeLeft(contentWidth, side) }}
              onResizeStart={(event) => startColumnResize(side, event)}
              onReset={() => setContentWidth(CONTENT.default)}
            />
          ))}
          <div className="editor-scroll flex-1 overflow-y-auto">
            <div
              /* 40px of gutter: enough for the 24px handle, which starts 26px
                 left of the text. The column's hairline is 40px out. */
              className="mx-auto w-full px-10 py-20"
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
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    setTitle(baseName);
                  }
                }}
                placeholder="Untitled"
                spellCheck={false}
                className="mb-2 block w-full resize-none overflow-hidden bg-transparent text-[38px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
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
    </main>
  );
}
