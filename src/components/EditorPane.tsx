import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useStore } from "../store/useStore";
import { toMarkdown } from "../lib/markdown";
import { saveAsset, stripExt } from "../lib/fs";
import {
  CONTENT,
  columnEdgeLeft,
  widthFromDrag,
  type ColumnSide,
} from "../lib/layout";
import { appExtensions } from "../editor/extensions";
import { setImageBaseDir } from "../editor/extensions/LocalImages";
import { setBufferSerializer, setCursorHeadingProvider } from "../lib/editorBuffer";
import { noteDir } from "../lib/imagePath";
import { loadDocument } from "../editor/loadDocument";
import { splitFrontmatter } from "../lib/frontmatter";
import { composeNote } from "../lib/compose";
import { headingAtLine, parseHeadings } from "../lib/outline";
import { altFromName, imageExtension, isImageFile } from "../lib/imagePaste";
import { BlockHandles } from "./BlockHandles";
import { CodeBlockLanguage } from "./CodeBlockLanguage";
import { PropertiesBlock } from "./PropertiesBlock";
import { ResizeHandle } from "./ResizeHandle";
import { SelectionToolbar } from "./SelectionToolbar";
import { SourcePane, type SourceHandle } from "./SourcePane";

// How long the editor waits after the last keystroke before saving: about a
// second, so a burst of typing is one write.
const AUTOSAVE_DELAY = 1000;
// How long the two views wait before catching up with each other.
const SYNC_DELAY = 250;

/**
 * What the open note is, as the editor sees it. The file's own text is the
 * source of truth: edits are applied to it as small patches rather than by
 * writing the editor's own serialisation, so lines the author never touched
 * stay byte-for-byte as they were.
 */
type Doc = {
  /** The file's text when it was loaded (or when the source view last took over). */
  original: string;
  /** Frontmatter and body of `original`. */
  frontmatter: string;
  body: string;
  /** What the rich editor serialises the body to, untouched. */
  baseline: string;
  /** Set while the source view holds edits the rich view has not caught up with. */
  sourceText: string | null;
};

export function EditorPane() {
  const notes = useStore((s) => s.notes);
  const activePath = useStore((s) => s.activePath);
  const loadId = useStore((s) => s.loadId);
  const markDirty = useStore((s) => s.markDirty);
  const save = useStore((s) => s.save);
  const renameNote = useStore((s) => s.renameNote);
  const setLiveText = useStore((s) => s.setLiveText);
  const view = useStore((s) => s.view);
  const headingRequest = useStore((s) => s.headingRequest);

  const [editorDom, setEditorDom] = useState<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const sourceRef = useRef<SourceHandle>(null);
  // The width lives in the store: the column's drag handles and the settings
  // slider are two controls over the same value.
  const contentWidth = useStore((s) => s.contentWidth);
  const setContentWidth = useStore((s) => s.setContentWidth);
  const tint = useStore((s) => s.tint);
  const [frontmatter, setFrontmatter] = useState("");
  const doc = useRef<Doc>({
    original: "",
    frontmatter: "",
    body: "",
    baseline: "",
    sourceText: null,
  });
  const lastFocus = useRef<"rich" | "source">("rich");

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

  /** The note's text as it should be on disk right now. */
  function composeText(): string {
    const d = doc.current;
    if (d.sourceText !== null) return d.sourceText;
    if (!editor) return d.original;
    return composeNote(d, toMarkdown(editor));
  }

  // Autosave about a second after the last edit, and when focus leaves the
  // editor. ⌘S still saves on demand.
  const saveTimer = useRef<number | null>(null);
  const syncTimer = useRef<number | null>(null);
  const liveTimer = useRef<number | null>(null);

  function cancelAutosave() {
    if (saveTimer.current === null) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
  }

  function flushSave() {
    cancelAutosave();
    const state = useStore.getState();
    if (!editor || !state.activePath || state.status !== "dirty") return;
    void state.save(composeText());
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
      void state.save(composeText());
    }, AUTOSAVE_DELAY);
  }

  useEffect(
    () => () => {
      cancelAutosave();
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
      if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    },
    [],
  );

  function refreshLiveText() {
    if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(() => {
      liveTimer.current = null;
      setLiveText(composeText());
    }, 200);
  }

  /** The rich view changed: the source view catches up. */
  function syncSourceFromRich() {
    if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncTimer.current = null;
      sourceRef.current?.setText(composeText());
    }, SYNC_DELAY);
  }

  /** The source view changed: the rich view catches up, and takes over from it. */
  function syncRichFromSource(text: string) {
    if (!editor) return;
    const split = splitFrontmatter(text);
    setFrontmatter(split.frontmatter);
    loadDocument(editor, split.body, { keepHistory: true });
    doc.current = {
      original: text,
      frontmatter: split.frontmatter,
      body: split.body,
      baseline: toMarkdown(editor),
      sourceText: doc.current.sourceText,
    };
  }

  async function insertImage(file: File) {
    const { activePath } = useStore.getState();
    if (!editor || !activePath) return;
    try {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      const src = await saveAsset(activePath, bytes, imageExtension(file));
      editor
        .chain()
        .focus()
        .setImage({ src, alt: altFromName(file.name) })
        .run();
    } catch (error) {
      useStore.getState().setError(`Couldn't save the image: ${String(error)}`);
    }
  }

  const editor = useEditor({
    extensions: appExtensions,
    content: "",
    editorProps: {
      attributes: { class: "tiptap", spellcheck: "true" },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find(isImageFile);
        if (!file) return false;
        event.preventDefault();
        void insertImage(file);
        return true;
      },
      handleDrop: (_view, event) => {
        const file = Array.from(event.dataTransfer?.files ?? []).find(isImageFile);
        if (!file) return false;
        event.preventDefault();
        void insertImage(file);
        return true;
      },
    },
    onUpdate: () => {
      // The rich view is in charge again.
      doc.current.sourceText = null;
      markDirty();
      scheduleAutosave();
      refreshLiveText();
      syncSourceFromRich();
    },
    onBlur: () => flushSave(),
  });

  useEffect(() => {
    // Keyed on loadId, not activePath: renaming the open note must not
    // replace the buffer with the content loaded when it was opened.
    const { activePath, activeContent } = useStore.getState();
    if (!editor || !activePath) return;
    cancelAutosave();
    const split = splitFrontmatter(activeContent);
    loadDocument(editor, split.body);
    doc.current = {
      original: activeContent,
      frontmatter: split.frontmatter,
      body: split.body,
      baseline: toMarkdown(editor),
      sourceText: null,
    };
    setFrontmatter(split.frontmatter);
    sourceRef.current?.setText(activeContent);
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
    if (useStore.getState().view === "source") sourceRef.current?.focus();
    else editor?.commands.focus("start", { scrollIntoView: false });
  }, [editor, editorFocusRequest]);

  useEffect(() => {
    // Relative image paths in a note are relative to the note's own folder.
    setImageBaseDir(noteDir(activePath));
  }, [activePath]);

  useEffect(() => {
    // Let the unsaved-changes prompt save this buffer on the user's behalf.
    if (!editor) return;
    setBufferSerializer(() => composeText());
    setCursorHeadingProvider(() => {
      const mode = useStore.getState().view;
      const useSource =
        mode === "source" || (mode === "split" && lastFocus.current === "source");
      if (useSource) {
        const line = sourceRef.current?.cursorLine() ?? 0;
        const text = sourceRef.current?.getText() ?? composeText();
        return headingAtLine(parseHeadings(text), line)?.index ?? -1;
      }
      let count = 0;
      const head = editor.state.selection.head;
      editor.state.doc.descendants((node, pos) => {
        if (pos >= head) return false;
        if (node.type.name === "heading") count += 1;
        return true;
      });
      return count - 1;
    });
    return () => {
      setBufferSerializer(null);
      setCursorHeadingProvider(null);
    };
    // composeText reads refs and the editor; it needs no other dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editor && activePath) void save(composeText());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    // Leaving the window counts as leaving the editor.
    window.addEventListener("blur", flushSave);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", flushSave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, activePath, save]);

  // Switching to a source view shows the text as it is now.
  useEffect(() => {
    if (view !== "rich") sourceRef.current?.setText(composeText());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // A click in the outline scrolls to the heading, in whichever view shows it.
  useEffect(() => {
    if (!headingRequest.n) return;
    const mode = useStore.getState().view;
    if (mode !== "rich" && sourceRef.current) {
      sourceRef.current.scrollToLine(headingRequest.line);
      return;
    }
    const heading = editorDom?.querySelectorAll("h1, h2, h3, h4, h5, h6")[headingRequest.index];
    heading?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [headingRequest, editorDom]);

  function onSourceChange(text: string) {
    doc.current.sourceText = text;
    markDirty();
    scheduleAutosave();
    setLiveText(text);
    if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncTimer.current = null;
      syncRichFromSource(text);
    }, SYNC_DELAY);
  }

  function onPropertiesChange(next: string) {
    const d = doc.current;
    d.frontmatter = next;
    setFrontmatter(next);
    d.sourceText = null;
    markDirty();
    scheduleAutosave();
    refreshLiveText();
    syncSourceFromRich();
  }

  const showRich = view !== "source";
  const showSource = view !== "rich";
  const split = view === "split";

  return (
    <main
      data-tint={tint}
      data-view={view}
      className="page relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]"
    >
      {activePath ? (
        <>
          {/* The page itself: the writing column's tint, full bleed — it runs
              from the titlebar to the bottom edge and rounds nothing. The
              handles' hairlines are the only edges it shows. */}
          {view === "rich" && (
            <>
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
            </>
          )}
          <div className="relative flex min-h-0 flex-1">
            {showSource && (
              <div
                className={`relative flex min-h-0 min-w-0 flex-1 ${
                  split ? "border-r border-[var(--border)]" : ""
                }`}
              >
                <SourcePane
                  ref={sourceRef}
                  initial={composeText()}
                  onChange={onSourceChange}
                  onFocusChange={(focused) => {
                    if (focused) lastFocus.current = "source";
                    else flushSave();
                  }}
                />
              </div>
            )}
            <div
              className="editor-scroll relative min-w-0 flex-1 overflow-y-auto"
              style={{ display: showRich ? undefined : "none" }}
              onFocusCapture={() => {
                lastFocus.current = "rich";
              }}
            >
              <div
                /* 40px top and bottom, 64px each side: the frame's column. */
                className="mx-auto w-full px-16 py-10"
                style={{ maxWidth: split ? undefined : contentWidth }}
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
                <PropertiesBlock frontmatter={frontmatter} onChange={onPropertiesChange} />
                <div ref={setEditorDom}>
                  <EditorContent editor={editor} />
                </div>
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

      <SelectionToolbar editor={editor} />
      <BlockHandles editor={editor} editorDom={editorDom} />
      <CodeBlockLanguage editor={editor} editorDom={editorDom} />
    </main>
  );
}
