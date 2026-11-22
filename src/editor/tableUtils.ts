import type { Editor } from "@tiptap/core";
import { TableMap } from "@tiptap/pm/tables";

export type Align = "left" | "center" | "right" | null;

/** The table around the caret: its position, node, and the caret's column. */
export function tableAtCaret(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d -= 1) {
    const node = $from.node(d);
    if (node.type.name !== "table") continue;
    const tablePos = $from.before(d);
    const map = TableMap.get(node);
    // The cell is one level inside the row, which is one inside the table.
    const cellPos = $from.before(d + 2) - tablePos - 1;
    const rect = map.findCell(cellPos);
    return { tablePos, node, map, column: rect.left, row: rect.top, cellPos: tablePos + 1 + cellPos };
  }
  return null;
}

/** Align one column: every cell in it, header included, as markdown does. */
export function alignColumn(editor: Editor, align: Align): boolean {
  const at = tableAtCaret(editor);
  if (!at) return false;
  const { tablePos, node, map, column } = at;
  const tr = editor.state.tr;
  for (let row = 0; row < map.height; row += 1) {
    const offset = map.map[row * map.width + column];
    const cell = node.nodeAt(offset);
    if (!cell) continue;
    tr.setNodeMarkup(tablePos + 1 + offset, undefined, { ...cell.attrs, align });
  }
  editor.view.dispatch(tr);
  return true;
}

/** The caret's column alignment. */
export function columnAlign(editor: Editor): Align {
  const at = tableAtCaret(editor);
  if (!at) return null;
  const cell = at.node.nodeAt(at.map.map[at.column]);
  return (cell?.attrs.align as Align) ?? null;
}

/** Put the caret in a cell of the table at `tablePos`, by row and column. */
export function caretToCell(editor: Editor, tablePos: number, row: number, column: number): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== "table") return false;
  const map = TableMap.get(table);
  const r = Math.max(0, Math.min(row, map.height - 1));
  const c = Math.max(0, Math.min(column, map.width - 1));
  // Inside the cell, then inside its first paragraph.
  const pos = tablePos + 1 + map.map[r * map.width + c] + 2;
  return editor.chain().focus().setTextSelection(pos).run();
}

/** Add a row after the last one, or a column after the last one. */
export function appendToTable(editor: Editor, tablePos: number, what: "row" | "column"): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  if (!caretToCell(editor, tablePos, map.height - 1, map.width - 1)) return false;
  return what === "row" ? editor.commands.addRowAfter() : editor.commands.addColumnAfter();
}
