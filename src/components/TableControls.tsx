import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Plus,
  Trash2,
} from "lucide-react";
import {
  alignColumn,
  appendToTable,
  columnAlign,
  tableAtCaret,
  type Align,
} from "../editor/tableUtils";
import { MenuCheck } from "./MenuCheck";

type Rect = { top: number; left: number; width: number; height: number };
type Layout = {
  tablePos: number;
  table: Rect;
  /** The caret's column and row, when the caret is in this table. */
  column: Rect | null;
  row: Rect | null;
};
type Open = { kind: "column" | "row"; top: number; left: number } | null;

const box = (r: DOMRect): Rect => ({ top: r.top, left: r.left, width: r.width, height: r.height });

/** The table under the pointer, or the one the caret is in. */
function tablePosOf(editor: Editor, el: Element | null): number | null {
  const dom = el?.closest(".tiptap table");
  if (!dom) return null;
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name !== "table") return true;
    const nodeDom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (nodeDom && (nodeDom === dom || nodeDom.contains(dom))) found = pos;
    return false;
  });
  return found;
}

function Item({
  icon,
  label,
  onClick,
  checked,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  checked?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block-menu-item${danger ? " is-danger" : ""}`}
      data-table-action={label}
    >
      <span className="block-menu-icon">{icon}</span>
      {label}
      {checked && <MenuCheck />}
    </button>
  );
}

/**
 * Table editing in place, the way Notion does it: a grip above the caret's
 * column and beside its row opens that column's or row's menu, and a thin
 * strip along the right and bottom edges adds a column or a row. Nothing
 * takes focus, so the caret stays in its cell.
 */
export function TableControls({ editor }: { editor: Editor | null }) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const hoverPos = useRef<number | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  layoutRef.current = layout;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    const ed = editor;

    function measure() {
      const at = ed.isFocused || open ? tableAtCaret(ed) : null;
      const tablePos = at?.tablePos ?? hoverPos.current;
      const dom = tablePos !== null ? (ed.view.nodeDOM(tablePos) as HTMLElement | null) : null;
      const tableEl = dom?.querySelector("table") ?? dom;
      if (tablePos === null || !tableEl) {
        setLayout(null);
        return;
      }
      let column: Rect | null = null;
      let row: Rect | null = null;
      if (at && at.tablePos === tablePos) {
        const cell = ed.view.nodeDOM(at.cellPos) as HTMLElement | null;
        const tr = cell?.parentElement;
        if (cell && tr) {
          const c = cell.getBoundingClientRect();
          const r = tr.getBoundingClientRect();
          column = { top: tableEl.getBoundingClientRect().top, left: c.left, width: c.width, height: 0 };
          row = box(r);
        }
      }
      setLayout({ tablePos, table: box(tableEl.getBoundingClientRect()), column, row });
    }

    function onMove(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target?.closest("[data-table-controls]")) return;
      const pos = tablePosOf(ed, target);
      // Keep the strips while the pointer crosses the gap to reach them.
      if (pos === null && hoverPos.current !== null && layoutRef.current) {
        const t = layoutRef.current.table;
        const near =
          event.clientX >= t.left - 4 && event.clientX <= t.left + t.width + 24 &&
          event.clientY >= t.top - 4 && event.clientY <= t.top + t.height + 24;
        if (near) return;
      }
      if (pos !== hoverPos.current) {
        hoverPos.current = pos;
        measure();
      }
    }
    function onDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(null);
    }

    ed.on("selectionUpdate", measure);
    ed.on("transaction", measure);
    ed.on("blur", measure);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ed.off("selectionUpdate", measure);
      ed.off("transaction", measure);
      ed.off("blur", measure);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [editor, open]);

  if (!editor || !layout) return null;
  const { table, column, row, tablePos } = layout;
  const align = columnAlign(editor);
  const c = () => editor.chain().focus();
  const done = (run: () => unknown) => () => {
    run();
    setOpen(null);
  };
  const alignTo = (value: Align) => done(() => alignColumn(editor, align === value ? null : value));

  return (
    <div data-table-controls onMouseDown={(event) => event.preventDefault()}>
      {column && (
        <button
          type="button"
          aria-label="Column options"
          aria-expanded={open?.kind === "column"}
          className="table-grip is-column"
          style={{ top: column.top - 9, left: column.left + column.width / 2 - 14 }}
          onClick={() =>
            setOpen(open?.kind === "column" ? null : { kind: "column", top: column.top + 8, left: column.left + column.width / 2 - 14 })
          }
        >
          <span />
          <span />
          <span />
        </button>
      )}
      {row && (
        <button
          type="button"
          aria-label="Row options"
          aria-expanded={open?.kind === "row"}
          className="table-grip is-row"
          style={{ top: row.top + row.height / 2 - 14, left: table.left - 9 }}
          onClick={() =>
            setOpen(open?.kind === "row" ? null : { kind: "row", top: row.top + row.height / 2 + 16, left: table.left - 9 })
          }
        >
          <span />
          <span />
          <span />
        </button>
      )}

      <button
        type="button"
        aria-label="Add column"
        title="Add column"
        className="table-add is-column"
        style={{ top: table.top, left: table.left + table.width + 4, height: table.height }}
        onClick={() => appendToTable(editor, tablePos, "column")}
      >
        <Plus size={12} />
      </button>
      <button
        type="button"
        aria-label="Add row"
        title="Add row"
        className="table-add is-row"
        style={{ top: table.top + table.height + 4, left: table.left, width: table.width }}
        onClick={() => appendToTable(editor, tablePos, "row")}
      >
        <Plus size={12} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="block-menu"
          style={{ top: open.top, left: open.left, minWidth: 190 }}
        >
          {open.kind === "column" ? (
            <>
              <Item icon={<ArrowLeftToLine size={15} />} label="Insert left" onClick={done(() => c().addColumnBefore().run())} />
              <Item icon={<ArrowRightToLine size={15} />} label="Insert right" onClick={done(() => c().addColumnAfter().run())} />
              <div className="block-menu-sep" />
              <Item icon={<AlignLeft size={15} />} label="Align left" checked={align === "left"} onClick={alignTo("left")} />
              <Item icon={<AlignCenter size={15} />} label="Align center" checked={align === "center"} onClick={alignTo("center")} />
              <Item icon={<AlignRight size={15} />} label="Align right" checked={align === "right"} onClick={alignTo("right")} />
              <div className="block-menu-sep" />
              <Item icon={<Trash2 size={15} />} label="Delete column" danger onClick={done(() => c().deleteColumn().run())} />
            </>
          ) : (
            <>
              <Item icon={<ArrowUpToLine size={15} />} label="Insert above" onClick={done(() => c().addRowBefore().run())} />
              <Item icon={<ArrowDownToLine size={15} />} label="Insert below" onClick={done(() => c().addRowAfter().run())} />
              <div className="block-menu-sep" />
              <Item icon={<Trash2 size={15} />} label="Delete row" danger onClick={done(() => c().deleteRow().run())} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
