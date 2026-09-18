import type { Editor } from "@tiptap/react";

export type BlockHover = {
  from: number;
  to: number;
  top: number;
  left: number;
  height: number;
};

export function blockAt(
  editor: Editor,
  clientX: number,
  clientY: number,
): BlockHover | null {
  if (!editor.isInitialized) return null;
  const view = editor.view;
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;

  const doc = view.state.doc;
  const index = doc.resolve(coords.pos).index(0);
  if (index < 0 || index >= doc.childCount) return null;

  let from = 0;
  for (let i = 0; i < index; i += 1) from += doc.child(i).nodeSize;
  const to = from + doc.child(index).nodeSize;

  const dom = view.nodeDOM(from) as HTMLElement | null;
  if (!dom) return null;

  const rect = dom.getBoundingClientRect();
  return { from, to, top: rect.top, left: rect.left, height: rect.height };
}

export function blockBoundaries(editor: Editor): number[] {
  const doc = editor.state.doc;
  const positions: number[] = [];
  let pos = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    positions.push(pos);
    pos += doc.child(i).nodeSize;
  }
  positions.push(pos);
  return positions;
}

export function dropTargetForY(editor: Editor, clientY: number): number {
  const doc = editor.state.doc;
  let pos = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (dom) {
      const rect = dom.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return pos;
    }
    pos += doc.child(i).nodeSize;
  }
  return pos;
}

export function moveBlockTo(
  editor: Editor,
  from: number,
  to: number,
  targetPos: number,
): void {
  const node = editor.state.doc.nodeAt(from);
  if (!node) return;

  const tr = editor.state.tr;
  tr.delete(from, to);
  let insertPos = targetPos > from ? targetPos - (to - from) : targetPos;
  insertPos = Math.max(0, Math.min(insertPos, tr.doc.content.size));
  tr.insert(insertPos, node);
  editor.view.dispatch(tr);
  editor.commands.focus();
}

export function deleteBlock(editor: Editor, from: number, to: number): void {
  editor.chain().focus().deleteRange({ from, to }).run();
  if (editor.state.doc.childCount === 0) {
    editor.chain().focus().insertContentAt(0, { type: "paragraph" }).run();
  }
}

export function duplicateBlock(editor: Editor, from: number, to: number): void {
  const node = editor.state.doc.nodeAt(from);
  if (!node) return;
  editor.chain().focus().insertContentAt(to, node.toJSON()).run();
}
