import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState, Annotation } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";

export type SourceHandle = {
  /** Replace the text from outside (a rich edit, a reload). Not reported back. */
  setText: (text: string) => void;
  getText: () => string;
  /** Scroll so the given zero-based line is at the top. */
  scrollToLine: (line: number) => void;
  /** The zero-based line the cursor is on. */
  cursorLine: () => number;
  focus: () => void;
};

// Marks a change we made ourselves, so it is not reported as an edit.
const external = Annotation.define<boolean>();

const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "var(--text)",
    fontSize: "13px",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "22px",
    padding: "40px 24px 80px",
  },
  ".cm-content": { caretColor: "var(--text)", maxWidth: "760px", margin: "0 auto" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--text)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
});

/**
 * The markdown source, in CodeMirror. It edits the file's exact text, so what is
 * saved from here is what is on screen, byte for byte.
 */
export const SourcePane = forwardRef<
  SourceHandle,
  {
    initial: string;
    onChange: (text: string) => void;
    onFocusChange?: (focused: boolean) => void;
  }
>(function SourcePane({ initial, onChange, onFocusChange }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  const focusChange = useRef(onFocusChange);
  change.current = onChange;
  focusChange.current = onFocusChange;

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          theme,
          EditorView.contentAttributes.of({ "aria-label": "Markdown source", spellcheck: "false" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((t) => t.annotation(external))) {
              change.current(update.state.doc.toString());
            }
            if (update.focusChanged) focusChange.current?.(update.view.hasFocus);
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The document is seeded once; later text arrives through setText.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    setText(text) {
      const editor = view.current;
      if (!editor || editor.state.doc.toString() === text) return;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: text },
        annotations: external.of(true),
      });
    },
    getText: () => view.current?.state.doc.toString() ?? "",
    scrollToLine(line) {
      const editor = view.current;
      if (!editor) return;
      const info = editor.state.doc.line(Math.min(editor.state.doc.lines, Math.max(1, line + 1)));
      editor.dispatch({
        selection: { anchor: info.from },
        effects: EditorView.scrollIntoView(info.from, { y: "start", yMargin: 8 }),
      });
    },
    cursorLine() {
      const editor = view.current;
      if (!editor) return 0;
      return editor.state.doc.lineAt(editor.state.selection.main.head).number - 1;
    },
    focus: () => view.current?.focus(),
  }));

  return <div ref={host} data-source-pane className="h-full min-w-0 flex-1 overflow-hidden" />;
});
