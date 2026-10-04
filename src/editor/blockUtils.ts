import type { Editor } from "@tiptap/react";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";

export type BlockHover = {
  from: number;
  to: number;
  top: number;
  left: number;
  height: number;
  label: string;
  depth: number;
};

/** A block the user can pick up: a top-level block, or a single list item. */
export type BlockRef = {
  from: number;
  to: number;
  depth: number;
  node: PMNode;
};

const LIST_TYPES = new Set(["bulletList", "orderedList", "taskList"]);

export function blockLabel(node: PMNode): string {
  switch (node.type.name) {
    case "heading":
      return `H${node.attrs.level}`;
    case "paragraph":
      return "Text";
    case "bulletList":
    case "orderedList":
      return "List";
    case "taskList":
      return "To-do";
    case "taskItem":
    case "listItem":
      return node.type.name === "taskItem" ? "To-do" : "List";
    case "blockquote":
      return "Quote";
    case "codeBlock":
      return "Code";
    case "horizontalRule":
      return "Divider";
    case "table":
      return "Table";
    case "image":
      return "Image";
    default:
      return node.type.name;
  }
}

function isListItem(node: PMNode): boolean {
  return node.type.name === "listItem" || node.type.name === "taskItem";
}

/**
 * Every movable block: a direct child of the document, or a list item at any
 * nesting depth. Everything else — the paragraphs inside a list item, a nested
 * list itself — belongs to the item that contains it and travels with it.
 *
 * Output is document order, outermost first.
 */
export function movableBlocks(doc: PMNode): BlockRef[] {
  const blocks: BlockRef[] = [];

  doc.descendants((node, pos, parent) => {
    if (!parent) return;
    const topLevel = parent.type.name === "doc";
    if (!topLevel && !isListItem(node)) return;

    blocks.push({
      from: pos,
      to: pos + node.nodeSize,
      depth: topLevel ? 0 : listDepth(doc, pos),
      node,
    });
  });

  return blocks;
}

/**
 * How many lists enclose the node at `pos`. Counting list ancestors rather than
 * using the resolved depth keeps the levels consecutive (1, 2, 3) so the drag
 * handle indents evenly at each level of nesting.
 */
function listDepth(doc: PMNode, pos: number): number {
  const $pos = doc.resolve(pos);
  let levels = 0;
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (LIST_TYPES.has($pos.node(depth).type.name)) levels += 1;
  }
  return levels;
}

/** The movable block containing `pos`, preferring the deepest one. */
export function blockContainingPos(doc: PMNode, pos: number): BlockRef | null {
  let best: BlockRef | null = null;
  for (const block of movableBlocks(doc)) {
    if (pos < block.from || pos > block.to) continue;
    if (!best || block.depth > best.depth || block.to - block.from < best.to - best.from) {
      best = block;
    }
  }
  return best;
}

function rectFor(editor: Editor, block: BlockRef): DOMRect | null {
  const dom = editor.view.nodeDOM(block.from) as HTMLElement | null;
  return dom ? dom.getBoundingClientRect() : null;
}

function toHover(block: BlockRef, rect: DOMRect): BlockHover {
  return {
    from: block.from,
    to: block.to,
    top: rect.top,
    left: rect.left,
    height: rect.height,
    label: blockLabel(block.node),
    depth: block.depth,
  };
}

export function blockAt(
  editor: Editor,
  clientX: number,
  clientY: number,
): BlockHover | null {
  if (!editor.isInitialized) return null;
  const view = editor.view;
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;

  const block = blockContainingPos(view.state.doc, coords.pos);
  if (!block) return null;

  // Prefer the smallest block whose box actually contains the pointer, so a
  // nested list item wins over the list that contains it.
  let best: BlockRef | null = null;
  let bestRect: DOMRect | null = null;
  for (const candidate of movableBlocks(view.state.doc)) {
    if (candidate.from !== block.from) continue;
    const rect = rectFor(editor, candidate);
    if (!rect) continue;
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      best = candidate;
      bestRect = rect;
      break;
    }
  }

  if (!best || !bestRect) {
    const rect = rectFor(editor, block);
    if (!rect) return null;
    return toHover(block, rect);
  }
  return toHover(best, bestRect);
}

export function blockAtY(editor: Editor, clientY: number): BlockHover | null {
  if (!editor.isInitialized) return null;

  let deepest: BlockRef | null = null;
  let deepestRect: DOMRect | null = null;
  let nearest: BlockHover | null = null;
  let nearestDist = Infinity;

  for (const block of movableBlocks(editor.state.doc)) {
    const rect = rectFor(editor, block);
    if (!rect) continue;

    if (clientY >= rect.top && clientY <= rect.bottom) {
      // Nested items sit inside their parent's box, so the first hit is the
      // outermost one; the deepest match is the one under the pointer.
      if (!deepest || block.depth > deepest.depth) {
        deepest = block;
        deepestRect = rect;
      }
    }

    const dist = Math.abs(clientY - (rect.top + rect.height / 2));
    if (dist < nearestDist) {
      nearest = toHover(block, rect);
      nearestDist = dist;
    }
  }

  if (deepest && deepestRect) return toHover(deepest, deepestRect);
  return nearest;
}

const LIST_ITEM_FOR: Record<string, string> = {
  bulletList: "listItem",
  orderedList: "listItem",
  taskList: "taskItem",
};

/**
 * Reshapes a dragged node to fit the drop target's depth.
 *
 * A list item is not a legal child of the document, and a paragraph is not a
 * legal child of a list, so a drag across that boundary has to convert rather
 * than move: lifting an item out of its list promotes its content, and dropping
 * a block into a list wraps it in an item of the right kind.
 *
 * Returns null when the node cannot be converted.
 */
export function adaptForParent(
  node: PMNode,
  $target: ResolvedPos,
): PMNode | null {
  const parentType = $target.parent.type.name;

  // depth 0 means the parent is the document itself.
  if ($target.depth === 0 && isListItem(node)) {
    // Only a plain single-block item can be promoted; anything richer would
    // lose its structure.
    if (node.childCount !== 1) return null;
    return node.child(0);
  }

  const itemType = LIST_ITEM_FOR[parentType];
  if (itemType && !isListItem(node)) {
    return node.type.schema.nodes[itemType]?.create(null, node) ?? null;
  }

  return node;
}

/** Whether `node` can be dropped at `pos`, converting it if that is what it takes. */
export function canDropAt(doc: PMNode, pos: number, node: PMNode): boolean {
  if (canInsertAt(doc, pos, node)) return true;
  if (pos < 0 || pos > doc.content.size) return false;
  try {
    const adapted = adaptForParent(node, doc.resolve(pos));
    return adapted ? canInsertAt(doc, pos, adapted) : false;
  } catch {
    return false;
  }
}
export function canInsertAt(doc: PMNode, pos: number, node: PMNode): boolean {
  if (pos < 0 || pos > doc.content.size) return false;
  try {
    const $pos = doc.resolve(pos);
    const index = $pos.index();
    // Wrap in a Fragment: canReplace reads its third argument as a Fragment, so
    // a bare Node is walked as though its inline children were block nodes and
    // every legal position reports false.
    return $pos.parent.canReplace(index, index, Fragment.from(node));
  } catch {
    return false;
  }
}

/**
 * The insertion point for a drop at `clientY`.
 *
 * The block under the cursor is found the same way hover finds it — deepest
 * block whose box contains the point — and the drop lands at its start or end
 * depending on which half the pointer is in. Iterating in document order
 * instead would resolve nested items in the top half of a list to the top of
 * the whole list, because a parent's box spans its children and the parent is
 * visited first.
 *
 * Only positions that can legally hold the dragged node are offered, so a drop
 * never produces a document that does not match the schema. Returns null when
 * nothing is a legal target.
 */
export function dropTargetForY(
  editor: Editor,
  clientY: number,
  dragged?: PMNode | null,
): number | null {
  const doc = editor.state.doc;

  const measured = movableBlocks(doc)
    .map((block) => ({ block, rect: rectFor(editor, block) }))
    .filter((entry): entry is { block: BlockRef; rect: DOMRect } => entry.rect !== null);

  if (measured.length === 0) return null;

  let chosen: { block: BlockRef; rect: DOMRect } | null = null;
  for (const entry of measured) {
    const { rect, block } = entry;
    if (clientY < rect.top || clientY > rect.bottom) continue;
    if (!chosen || block.depth > chosen.block.depth) chosen = entry;
  }

  if (!chosen) {
    // Pointer is in a gap; use whichever block's middle is closest.
    let best = measured[0];
    let bestDist = Infinity;
    for (const entry of measured) {
      const dist = Math.abs(clientY - (entry.rect.top + entry.rect.height / 2));
      if (dist < bestDist) {
        best = entry;
        bestDist = dist;
      }
    }
    chosen = best;
  }

  const { block, rect } = chosen;
  const after = clientY >= rect.top + rect.height / 2;
  const candidates = after ? [block.to, block.from] : [block.from, block.to];

  if (!dragged) return candidates[0];
  for (const pos of candidates) {
    if (canDropAt(doc, pos, dragged)) return pos;
  }
  return null;
}

/**
 * Moves a block to `targetPos`.
 *
 * Deleting first shifts every later position, so the target is corrected for
 * the removed range. An illegal move is abandoned rather than dispatched,
 * because ProseMirror would otherwise build a document that does not match the
 * schema. Deleting a list item can leave its list empty, which is not a valid
 * document either, so emptied lists are removed.
 */
export function moveBlockTo(
  editor: Editor,
  from: number,
  to: number,
  targetPos: number,
): void {
  const node = editor.state.doc.nodeAt(from);
  if (!node) return;

  // A list must contain at least one item, so deleting the last item cannot
  // leave the list behind: ProseMirror would keep it and leave an empty `- ` in
  // the note. Take the whole list out of the document instead.
  const $from = editor.state.doc.resolve(from);
  const sourceIsList = LIST_TYPES.has($from.parent.type.name);
  const emptiesSourceList = sourceIsList && $from.parent.childCount === 1;

  const delFrom = emptiesSourceList ? from - 1 : from;
  const delTo = emptiesSourceList ? to + 1 : to;

  const tr = editor.state.tr;
  tr.delete(delFrom, delTo);

  let insertPos = targetPos > delFrom ? targetPos - (delTo - delFrom) : targetPos;
  insertPos = Math.max(0, Math.min(insertPos, tr.doc.content.size));

  // Convert across a list boundary if the node cannot sit there as it is.
  let payload = node;
  if (!canInsertAt(tr.doc, insertPos, node)) {
    try {
      const adapted = adaptForParent(node, tr.doc.resolve(insertPos));
      if (!adapted || !canInsertAt(tr.doc, insertPos, adapted)) return;
      payload = adapted;
    } catch {
      return;
    }
  }

  tr.insert(insertPos, payload);
  editor.view.dispatch(removeEmptyLists(tr));
  editor.commands.focus();
}

/** Drops lists left with no items, which no valid document may contain. */
function removeEmptyLists(
  tr: Parameters<Editor["view"]["dispatch"]>[0],
): typeof tr {
  tr.doc.descendants((node, pos) => {
    if (!LIST_TYPES.has(node.type.name) || node.childCount > 0) return;
    tr.delete(pos, pos + node.nodeSize);
  });
  return tr;
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

/** Swaps a block with its previous or next sibling at the same depth. */
export function moveSibling(
  editor: Editor,
  from: number,
  to: number,
  direction: -1 | 1,
): void {
  const block = movableBlocks(editor.state.doc).find((b) => b.from === from);
  if (!block) return;

  const $from = editor.state.doc.resolve(from);
  // $from.parent, not $from.nodeAfter: at depth 0 the node after the position
  // is the block itself, whose childCount is its inline content, so the sibling
  // bounds would be wrong.
  const parent = $from.parent;
  const target = direction === -1 ? $from.index() - 1 : $from.index() + 1;
  if (!parent || target < 0 || target >= parent.childCount) return;

  const startOf = (index: number) => {
    let cursor = $from.start();
    for (let i = 0; i < index; i += 1) cursor += parent.child(i).nodeSize;
    return cursor;
  };

  // Moving down has to land *after* the next sibling. Targeting the next
  // sibling's own start looks right, but moveBlockTo shifts the target back by
  // the deleted range, which puts the node straight back where it began.
  const targetPos =
    direction === -1 ? startOf(target) : startOf(target + 1);

  moveBlockTo(editor, from, to, targetPos);
}