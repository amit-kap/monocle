import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import {
  blockAt,
  blockAtY,
  blockForm,
  deleteBlock,
  dropTargetForY,
  duplicateBlock,
  moveBlockTo,
  moveSibling,
  turnIntoBlock,
  TURN_INTO,
  TURN_INTO_MORE,
  type BlockHover,
  type TurnIntoKind,
} from "../editor/blockUtils";
import { MenuCheck } from "./MenuCheck";
import { MENU_GAP_BELOW, menuTop } from "../lib/placement";

type MenuState = {
  from: number;
  to: number;
  top: number;
  left: number;
  label: string;
};

type Anchor = Pick<BlockHover, "from" | "to" | "top" | "left" | "label">;

/** A submenu hangs off its trigger's right edge, flipping when the window ends. */
type SubmenuState = { top: number; left: number };

function HandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="4" r="1.2" />
      <circle cx="10" cy="4" r="1.2" />
      <circle cx="6" cy="8" r="1.2" />
      <circle cx="10" cy="8" r="1.2" />
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="10" cy="12" r="1.2" />
    </svg>
  );
}

/** A fixed 18px slot for every item's icon, so the labels line up. */
function GlyphIcon({ children }: { children: string }) {
  return <span className="block-menu-icon block-menu-glyph">{children}</span>;
}

function LineIcon({ children }: { children: ReactNode }) {
  return (
    <span className="block-menu-icon">
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </span>
  );
}

function BlockTypeIcon({ kind }: { kind: TurnIntoKind }) {
  switch (kind) {
    case "paragraph":
      return (
        <LineIcon>
          <path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5" />
        </LineIcon>
      );
    case 1:
      return <GlyphIcon>H1</GlyphIcon>;
    case 2:
      return <GlyphIcon>H2</GlyphIcon>;
    case 3:
      return <GlyphIcon>H3</GlyphIcon>;
    case "bulletList":
      return (
        <LineIcon>
          <path d="M6 4h7.5M6 8h7.5M6 12h7.5" />
          <circle cx="3" cy="4" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="3" cy="8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="3" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </LineIcon>
      );
    case "orderedList":
      return <GlyphIcon>1.</GlyphIcon>;
    case "taskList":
      return (
        <LineIcon>
          <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.4" />
          <path d="m5.4 8.2 1.9 1.9 3.6-4" />
        </LineIcon>
      );
    case "blockquote":
      return (
        <LineIcon>
          <path d="M3.6 3v10M7 4.5h6M7 8h6M7 11.5h3.5" />
        </LineIcon>
      );
    case "codeBlock":
      return <GlyphIcon>{"</>"}</GlyphIcon>;
    case "divider":
      return (
        <LineIcon>
          <path d="M2.5 8h11" />
        </LineIcon>
      );
  }
}

function MoreBlocksIcon() {
  return (
    <LineIcon>
      <rect x="2.5" y="2.5" width="4.2" height="4.2" rx="1" />
      <rect x="9.3" y="2.5" width="4.2" height="4.2" rx="1" />
      <rect x="2.5" y="9.3" width="4.2" height="4.2" rx="1" />
      <rect x="9.3" y="9.3" width="4.2" height="4.2" rx="1" />
    </LineIcon>
  );
}

function DuplicateIcon() {
  return (
    <LineIcon>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </LineIcon>
  );
}

function MoveIcon({ direction }: { direction: -1 | 1 }) {
  return (
    <LineIcon>
      {direction === -1 ? (
        <path d="M8 13V3M4.5 6.5 8 3l3.5 3.5" />
      ) : (
        <path d="M8 3v10M4.5 9.5 8 13l3.5-3.5" />
      )}
    </LineIcon>
  );
}

function DeleteIcon() {
  return (
    <LineIcon>
      <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.6 8.2a1.5 1.5 0 0 0 1.5 1.3h3.8a1.5 1.5 0 0 0 1.5-1.3l.6-8.2" />
    </LineIcon>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="block-menu-chevron"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  );
}

export function BlockHandles({
  editor,
  editorDom,
}: {
  editor: Editor | null;
  editorDom: HTMLElement | null;
}) {
  const [hover, setHover] = useState<BlockHover | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [submenu, setSubmenu] = useState<SubmenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  // The menu's height is only known once it is in the DOM, so its `top` is
  // settled after the first render — null until then.
  const [menuY, setMenuY] = useState<number | null>(null);
  const [submenuY, setSubmenuY] = useState<number | null>(null);
  const [dropY, setDropY] = useState<number | null>(null);
  const dragging = useRef(false);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!menu || !el) return;
    setMenuY(
      menuTop({
        anchorTop: menu.top,
        height: el.offsetHeight,
        viewportBottom: window.innerHeight,
      }),
    );
  }, [menu]);

  useLayoutEffect(() => {
    const el = submenuRef.current;
    if (!submenu || !el) return;
    setSubmenuY(
      Math.min(
        Math.max(8, submenu.top),
        Math.max(8, window.innerHeight - 8 - el.offsetHeight),
      ),
    );
  }, [submenu]);

  useEffect(() => {
    if (!editor || !editorDom) return;
    const dom = editorDom;
    const scroller = dom.closest(".editor-scroll") as HTMLElement | null;

    function onMove(event: MouseEvent) {
      if (dragging.current || menu) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".block-handle") || target?.closest(".block-menu")) {
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
          setHover(null);
          return;
        }
      }
      setHover((current) => {
        if (current) {
          const withinBand =
            event.clientY >= current.top - 6 &&
            event.clientY <= current.top + current.height + 6;
          const inGutter = event.clientX <= current.left + 2;
          if (withinBand && inGutter) return current;
        }
        return (
          blockAt(editor!, event.clientX, event.clientY) ??
          blockAtY(editor!, event.clientY)
        );
      });
    }
    function onScroll() {
      setHover(null);
      setMenu(null);
      setSubmenu(null);
      setDropY(null);
    }
    function onWindowMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".block-menu")) {
        setMenu(null);
        setSubmenu(null);
      }
    }

    // Block positions and rects go stale on any edit (e.g. deleting a block
    // with Backspace), so hide the handle until the mouse moves again.
    function onTransaction({ transaction }: { transaction: Transaction }) {
      if (!transaction.docChanged || dragging.current) return;
      setHover(null);
      setMenu(null);
      setSubmenu(null);
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

  function turnInto(from: number, kind: TurnIntoKind) {
    if (!editor) return;
    turnIntoBlock(editor, from, kind);
    setMenu(null);
    setSubmenu(null);
  }

  function openSubmenu(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!menu) return;
    const trigger = event.currentTarget.getBoundingClientRect();
    const panel = menuRef.current?.getBoundingClientRect();
    const width = panel?.width ?? 200;
    const right = panel?.right ?? trigger.right;
    const left = panel?.left ?? trigger.left;
    setSubmenuY(null);
    setSubmenu({
      top: trigger.top - 5,
      // Open to the right of the menu, or to its left when the window ends.
      left: right + 4 + width > window.innerWidth - 8 ? left - width - 4 : right + 4,
    });
  }

  function move(from: number, to: number, direction: -1 | 1) {
    if (!editor) return;
    moveSibling(editor, from, to, direction);
    setMenu(null);
  }

  function startDrag(event: ReactMouseEvent<HTMLElement>, anchor: Anchor) {
    if (!editor || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let started = false;
    let target: number | null = null;
    // Captured before the move: after a deletion the node's position changes.
    const dragged = editor.state.doc.nodeAt(anchor.from) ?? null;

    function endDrag() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDropY(null);
    }

    function onMove(moveEvent: MouseEvent) {
      if (!started) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) {
          return;
        }
        started = true;
        dragging.current = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      target = dropTargetForY(editor!, moveEvent.clientY, dragged);
      const targetDom =
        target === null ? null : (editor!.view.nodeDOM(target) as HTMLElement | null);
      const rect = targetDom?.getBoundingClientRect();
      setDropY(rect ? rect.top : moveEvent.clientY);
    }

    function onUp() {
      const moved = started;
      endDrag();
      if (moved) {
        if (target !== null) {
          moveBlockTo(editor!, anchor.from, anchor.to, target);
        }
      } else {
        setMenuY(null);
        setMenu({
          from: anchor.from,
          to: anchor.to,
          top: anchor.top,
          left: anchor.left,
          label: anchor.label,
        });
      }
    }

    function onKey(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") endDrag();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
  }

  const handleTop = hover
    ? hover.top + Math.max(0, Math.min(hover.height, 28) - 24) / 2
    : 0;
  const currentForm = menu && editor ? blockForm(editor, menu.from) : null;
  const closeSubmenu = () => setSubmenu(null);

  return (
    <>
      {(hover || menu) &&
        (() => {
          const anchor = menu ?? hover!;
          return (
            <button
              type="button"
              title="Drag to move, click for menu"
              onMouseDown={(event) => startDrag(event, anchor)}
              className={`block-handle${menu ? " is-active" : ""}`}
              style={{ top: handleTop, left: anchor.left - 26 }}
            >
              <HandleIcon />
            </button>
          );
        })()}

      {menu && (
        <div
          ref={menuRef}
          className="block-menu"
          style={{
            top: menuY ?? menu.top + MENU_GAP_BELOW,
            left: menu.left - 26,
          }}
        >
          <div className="block-menu-label">{menu.label}</div>
          {TURN_INTO.map((option) => {
            const current = option.form === currentForm;
            return (
              <button
                key={option.label}
                type="button"
                className="block-menu-item"
                onMouseEnter={closeSubmenu}
                onClick={() => turnInto(menu.from, option.kind)}
              >
                <BlockTypeIcon kind={option.kind} />
                {option.label}
                {current && <MenuCheck />}
              </button>
            );
          })}
          <button
            type="button"
            className={`block-menu-item${submenu ? " is-selected" : ""}`}
            onMouseEnter={openSubmenu}
            onClick={openSubmenu}
          >
            <MoreBlocksIcon />
            More blocks
            <ChevronRightIcon />
          </button>
          <div className="block-menu-sep" />
          <button
            type="button"
            className="block-menu-item"
            onMouseEnter={closeSubmenu}
            onClick={() => {
              duplicateBlock(editor!, menu.from, menu.to);
              setMenu(null);
            }}
          >
            <DuplicateIcon />
            Duplicate
          </button>
          <button
            type="button"
            className="block-menu-item"
            onMouseEnter={closeSubmenu}
            onClick={() => move(menu.from, menu.to, -1)}
          >
            <MoveIcon direction={-1} />
            Move up
          </button>
          <button
            type="button"
            className="block-menu-item"
            onMouseEnter={closeSubmenu}
            onClick={() => move(menu.from, menu.to, 1)}
          >
            <MoveIcon direction={1} />
            Move down
          </button>
          <div className="block-menu-sep" />
          <button
            type="button"
            className="block-menu-item is-danger"
            onMouseEnter={closeSubmenu}
            onClick={() => {
              deleteBlock(editor!, menu.from, menu.to);
              setMenu(null);
              setHover(null);
            }}
          >
            <DeleteIcon />
            Delete
          </button>
        </div>
      )}

      {menu && submenu && (
        <div
          ref={submenuRef}
          className="block-menu block-submenu"
          style={{ top: submenuY ?? submenu.top, left: submenu.left }}
        >
          {TURN_INTO_MORE.map((option) => (
            <button
              key={option.label}
              type="button"
              className="block-menu-item"
              onClick={() => turnInto(menu.from, option.kind)}
            >
              <BlockTypeIcon kind={option.kind} />
              {option.label}
              {option.form === currentForm && <MenuCheck />}
            </button>
          ))}
        </div>
      )}

      {dropY !== null && (
        <div className="drop-line" style={{ top: dropY }} aria-hidden />
      )}
    </>
  );
}