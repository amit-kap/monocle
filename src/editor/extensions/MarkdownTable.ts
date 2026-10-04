import { Table } from "@tiptap/extension-table";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";

// tiptap-markdown ships a table serializer with two defects that rewrite the
// user's table on every save:
//
//   1. A pipe inside a cell is written bare, so the cell text `x | y` comes out
//      as `| x | y |` — one cell silently becomes two.
//   2. Column alignment is parsed into each header cell's `align` attribute but
//      never written back, so `:---:` becomes `---` and the alignment is lost
//      on the first save.
//
// Both are fixed here. Tables that markdown cannot express (merged cells,
// multi-block cells) degrade to plain text rather than being dropped; markdown
// itself has no syntax for either, so this cannot be reached from a parsed
// file — it is only a guard for tables a future editing UI might create.

type Cell = PMNode;

// prosemirror-markdown's published type omits the `out` buffer that
// tiptap-markdown's state subclass exposes.
type TableState = MarkdownSerializerState & { out: string };

const DELIMITER: Record<string, string> = {
  left: ":---",
  right: "---:",
  center: ":---:",
};

function cells(node: PMNode): readonly Cell[] {
  return node.content.content;
}

function hasSpan(cell: Cell): boolean {
  return cell.attrs.colspan > 1 || cell.attrs.rowspan > 1;
}

function isMarkdownTable(node: PMNode): boolean {
  const [firstRow, ...bodyRows] = cells(node);

  if (
    firstRow === undefined ||
    firstRow.children.some(
      (cell) => cell.type.name !== "tableHeader" || hasSpan(cell) || cell.childCount > 1,
    )
  ) {
    return false;
  }
  return !bodyRows.some((row) =>
    row.children.some(
      (cell) => cell.type.name === "tableHeader" || hasSpan(cell) || cell.childCount > 1,
    ),
  );
}

// tiptap-markdown resolves a node's markdown spec by extension *name*, so this
// has to extend `table` itself rather than sit alongside it — a separate
// extension would never be consulted.
export const MarkdownTable = Table.extend({
  name: "table",

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          const out = state as TableState;
          const rows = cells(node);

          if (!isMarkdownTable(node)) {
            for (const row of rows) {
              state.write(`${row.children.map((cell) => cell.textContent).join(" | ")}\n`);
            }
            state.closeBlock(node);
            return;
          }

          // `renderInline` escapes markdown punctuation but not the cell
          // delimiter, so escape any bare pipe in the text it just produced.
          // A literal `\|` in the source reaches us as a plain `|`, so this
          // cannot double-escape. Splitting around `\|` avoids a lookbehind,
          // which older WebKit cannot even parse.
          const writeCell = (cell: Cell) => {
            const content = cell.firstChild;
            if (!content?.textContent.trim()) return;

            const from = out.out.length;
            out.renderInline(content);
            const rendered = out.out
              .slice(from)
              .split(/(\\\|)/)
              .map((part: string) => (part === "\\|" ? part : part.replace(/\|/g, "\\|")))
              .join("");
            out.out = out.out.slice(0, from) + rendered;
          };

          rows.forEach((row, rowIndex) => {
            state.write("| ");
            row.forEach((cell, cellIndex) => {
              if (cellIndex) state.write(" | ");
              writeCell(cell);
            });
            state.write(" |");
            state.ensureNewLine();

            if (rowIndex === 0) {
              const delimiters = row.children.map(
                (cell) => DELIMITER[cell.attrs.align as string] ?? "---",
              );
              state.write(`| ${delimiters.join(" | ")} |`);
              state.ensureNewLine();
            }
          });

          state.closeBlock(node);
        },
      },
    };
  },
});