import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { lowlight } from "../editor/extensions/CodeBlock";
import {
  filterLanguages,
  findLanguage,
  languageOptions,
  tagFor,
  type LanguageOption,
} from "../lib/languages";
import { scrollDelta } from "../lib/scroll";
import { MenuCheck } from "./MenuCheck";

type Anchor = {
  /** The code block the label belongs to. */
  dom: HTMLElement;
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** The fence's tag as the author wrote it, empty for none. */
  language: string;
};

/** How tall the menu may get before it is placed above the block instead. */
const MENU_HEIGHT = 320;

/** The menu's width, so it can be kept inside the window it opens in. */
const MENU_WIDTH = 220;

/** Where the code block rendered by `dom` starts in the document. */
function codeBlockPos(editor: Editor, dom: HTMLElement): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock" && editor.view.nodeDOM(pos) === dom) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

function anchorFor(editor: Editor, dom: HTMLElement): Anchor {
  const rect = dom.getBoundingClientRect();
  const pos = codeBlockPos(editor, dom);
  const language = pos === null ? null : editor.state.doc.nodeAt(pos)?.attrs.language;
  return {
    dom,
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    language: typeof language === "string" ? language : "",
  };
}

/**
 * The language a code block is highlighted as, in its top-right corner, and the
 * picker behind it. It reads the fence's tag (so a block tagged `js` shows
 * JavaScript) and writes the tag back, keeping the author's spelling.
 */
export function CodeBlockLanguage({
  editor,
  editorDom,
}: {
  editor: Editor | null;
  editorDom: HTMLElement | null;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Whether the caret was in the note when the picker opened: only then does
  // closing it put the focus back, so the label never pulls focus into a note
  // the user was not writing in.
  const hadFocus = useRef(false);

  const options = useMemo(() => languageOptions(lowlight.listLanguages()), []);
  const items = useMemo(
    () => filterLanguages(options, query),
    [options, query],
  );

  useEffect(() => {
    if (!editor || !editorDom) return;
    const dom = editorDom;
    const scroller = dom.closest(".editor-scroll") as HTMLElement | null;

    function onMove(event: MouseEvent) {
      if (menu) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".code-lang") || target?.closest(".code-lang-menu")) {
        return;
      }
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          setAnchor(null);
          return;
        }
      }
      setAnchor((current) => {
        if (current) {
          const onBlock =
            event.clientY >= current.top - 4 &&
            event.clientY <= current.bottom + 4 &&
            event.clientX >= current.left - 4 &&
            event.clientX <= current.right + 4;
          if (onBlock) return current;
        }
        const pre = (target?.closest("pre") as HTMLElement | null) ?? null;
        if (!pre || !dom.contains(pre)) return null;
        return anchorFor(editor!, pre);
      });
    }

    function onScroll() {
      setAnchor(null);
      setMenu(null);
    }

    function onWindowMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest(".code-lang-menu") || target.closest(".code-lang")) {
        return;
      }
      setMenu(null);
    }

    // Rects and positions go stale on any edit, so drop the label until the
    // mouse moves again.
    function onTransaction({ transaction }: { transaction: Transaction }) {
      if (!transaction.docChanged) return;
      setAnchor(null);
      setMenu(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onWindowMouseDown);
    scroller?.addEventListener("scroll", onScroll);
    editor.on("transaction", onTransaction);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onWindowMouseDown);
      scroller?.removeEventListener("scroll", onScroll);
      editor.off("transaction", onTransaction);
    };
  }, [editor, editorDom, menu]);

  useEffect(() => {
    // Arrow keys move the highlight, but the list scrolls on its own, so the
    // selection walks off the bottom without this.
    const list = listRef.current;
    const item = list?.children[selected] as HTMLElement | undefined;
    if (!list || !item) return;
    list.scrollTop += scrollDelta(
      list.getBoundingClientRect(),
      item.getBoundingClientRect(),
    );
  }, [selected, items]);

  function openMenu(from: Anchor) {
    hadFocus.current = Boolean(editor?.isFocused);
    setQuery("");
    setSelected(0);
    setMenu(from);
  }

  function closeMenu(refocus: boolean) {
    setMenu(null);
    if (refocus && hadFocus.current) editor?.commands.focus();
  }

  function pick(option: LanguageOption) {
    const from = menu;
    if (!editor || !from) return;
    const pos = codeBlockPos(editor, from.dom);
    closeMenu(true);
    if (pos === null) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    const language = tagFor(from.language, option);
    if (language === (node.attrs.language ?? "")) return;
    // A plain transaction: the caret and the selection stay where they are.
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, language }),
    );
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (items.length === 0) return;
      const step = event.key === "ArrowUp" ? -1 : 1;
      setSelected((current) => (current + step + items.length) % items.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = items[selected];
      if (option) pick(option);
    }
  }

  // Above the block when there is no room below it, and kept off the window's
  // edges: a narrow column would otherwise push it out of view.
  const menuStyle = menu
    ? (() => {
        const left = Math.max(
          8,
          Math.min(
            menu.right - 8 - MENU_WIDTH,
            window.innerWidth - MENU_WIDTH - 8,
          ),
        );
        return menu.bottom + 8 + MENU_HEIGHT <= window.innerHeight
          ? { top: menu.top + 28, left, width: MENU_WIDTH }
          : { bottom: window.innerHeight - menu.top + 6, left, width: MENU_WIDTH };
      })()
    : undefined;

  const current = anchor ? findLanguage(anchor.language, options) : null;

  return (
    <>
      {anchor && (
        <button
          type="button"
          title="Code language"
          className={`code-lang${menu ? " is-active" : ""}`}
          style={{ top: anchor.top + 6, left: anchor.right - 8 }}
          // Keeping the mousedown from reaching the editor leaves the caret —
          // and any selection — exactly as the writer left it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openMenu(anchor)}
        >
          {current?.label ?? anchor.language.trim()}
        </button>
      )}

      {menu && (
        <div className="code-lang-menu block-menu" style={menuStyle}>
          <input
            className="code-lang-search"
            autoFocus
            spellCheck={false}
            placeholder="Search languages"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setSelected(0);
            }}
            onKeyDown={onSearchKeyDown}
          />
          <div className="code-lang-list" ref={listRef}>
            {items.map((option, index) => (
              <button
                key={option.label}
                type="button"
                className={`block-menu-item${index === selected ? " is-selected" : ""}`}
                onMouseEnter={() => setSelected(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(option)}
              >
                {option.label}
                {option === current && <MenuCheck />}
              </button>
            ))}
            {items.length === 0 && (
              <div className="code-lang-empty">No language by that name</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
