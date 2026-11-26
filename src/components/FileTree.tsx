import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { ChangeNotice, TreeNode } from "../types";
import { useStore } from "../store/useStore";
import { isEmptyDir, isHiddenDir, rowLabel } from "../lib/treeView";
import {
  ChevronDown,
  ChevronRight,
  EllipsisIcon,
  FileTextIcon,
  FolderDotIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderRootIcon,
  PlusIcon,
} from "./icons";

type Handlers = {
  activePath: string | null;
  /** The folder whose page is open. */
  folderPage: string | null;
  expanded: Set<string>;
  forceExpand: boolean;
  /** The row Tab reaches, so the tree is keyboard-reachable at all. */
  tabbablePath: string | null;
  /** The row the ⌘P search is on, highlighted while the search box has focus. */
  highlightPath: string | null;
  /** Only the keyboard earns the brass ring; a click just selects. */
  keyboardRing: boolean;
  /** The row being renamed (by its rename target path). */
  renamingPath: string | null;
  /** Files changed on disk and not yet reviewed. */
  changes: Record<string, ChangeNotice>;
  /** The chevron: fold or unfold, nothing else. */
  onToggle: (path: string) => void;
  /** The folder's name: show its page, leaving the tree as it is. */
  onOpenFolder: (node: TreeNode) => void;
  onOpen: (path: string) => void;
  onMenu: (node: TreeNode, x: number, y: number) => void;
  onRename: (path: string, name: string) => void;
  onCancelRename: () => void;
  onFocusRow: (path: string) => void;
  /** A Place header's plus: a new note at the top of that Place. */
  onNewNote: (dir: string) => void;
};

/** What a rename acts on: a folded folder row renames its innermost folder. */
export function renameTarget(node: TreeNode): string {
  return node.kind === "dir" ? (node.openPath ?? node.path) : node.path;
}

/**
 * Rows are containers, so they opt into focus with a tabindex; a click on one
 * of their own controls must not pull focus away from that control.
 */
function focusUnlessControl(event: ReactMouseEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;
  if (target.closest("input, button")) return;
  event.currentTarget.focus();
}

function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Select the name, not the extension.
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  function finish(commit: boolean, value: string) {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(value);
    else onCancel();
  }

  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label="Name"
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => finish(true, event.currentTarget.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(true, event.currentTarget.value);
        if (event.key === "Escape") finish(false, "");
      }}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      autoComplete="off"
      className="min-w-0 flex-1 rounded border border-[var(--accent)] bg-[var(--bg)] px-1 py-0.5 text-[13px] text-[var(--text)] outline-none"
    />
  );
}

function DotsButton({
  node,
  visible,
  onMenu,
}: {
  node: TreeNode;
  visible: boolean;
  onMenu: Handlers["onMenu"];
}) {
  return (
    <button
      type="button"
      title="More"
      aria-label="More actions"
      onClick={(event) => {
        event.stopPropagation();
        const box = event.currentTarget.getBoundingClientRect();
        onMenu(node, box.left, box.bottom + 2);
      }}
      className={`grid size-6 shrink-0 place-items-center rounded text-[var(--text-faint)] hover:bg-[var(--bg-active)] hover:text-[var(--text)] ${
        visible ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
      }`}
    >
      <EllipsisIcon className="size-3.5" />
    </button>
  );
}

function Row({
  node,
  open,
  selected,
  focused,
  highlighted,
  depth,
  handlers,
}: {
  node: TreeNode;
  depth: number;
  open: boolean;
  selected: boolean;
  focused: boolean;
  highlighted: boolean;
  handlers: Handlers;
}) {
  const isDir = node.kind === "dir";
  const target = renameTarget(node);
  const renaming = handlers.renamingPath === target;
  const changed = !isDir && Boolean(handlers.changes[node.path]);
  const tone = selected
    ? "bg-[var(--bg-active)] text-[var(--text)]"
    : `text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]${
        highlighted ? " bg-[var(--bg-hover)] text-[var(--text)]" : ""
      }`;
  // A folder with no note anywhere inside is dimmed: it is still a folder you
  // can open, name, or make a note in, it just has nothing to read yet.
  const dim = isDir && node.hasNotes === false && !selected;
  const innerName = isDir ? (node.label?.[node.label.length - 1] ?? node.name) : node.name;
  // The open note's title, as it is being typed in the editor.
  const draft = useStore((s) =>
    !isDir && s.titleDraft?.path === node.path ? s.titleDraft.name : null,
  );
  const fileName = draft ? draft + (/\.(md|markdown)$/i.exec(node.name)?.[0] ?? ".md") : node.name;

  return (
    <div
      data-tree-row={node.path}
      data-kind={node.kind}
      data-active={selected}
      data-dim={dim || undefined}
      tabIndex={focused ? 0 : -1}
      onMouseDown={focusUnlessControl}
      onFocus={() => handlers.onFocusRow(node.path)}
      onClick={() => {
        if (renaming) return;
        if (isDir) handlers.onOpenFolder(node);
        else handlers.onOpen(node.path);
      }}
      // A click shows a folder's page; a double-click also expands it.
      onDoubleClick={(event) => {
        if (renaming || !isDir || isEmptyDir(node)) return;
        if ((event.target as HTMLElement).closest("button, input")) return;
        handlers.onToggle(node.path);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        handlers.onMenu(node, event.clientX, event.clientY);
      }}
      // The row spans the pane, so its hover and selection do too; the indent
      // is padding on the left, which moves only the content.
      style={{ paddingLeft: (isDir ? 5 : 8) + depth * 18 }}
      className={`group/row relative flex h-8 cursor-default items-center gap-2 rounded-[var(--radius)] pr-2 text-[13px] outline-none ${
        focused && handlers.keyboardRing ? "tree-ring" : ""} ${tone}`}
    >
      {isDir && isEmptyDir(node) && (
        // Nothing inside to show: a blank the chevron's width keeps the icon
        // in line with its siblings.
        <span aria-hidden className="h-6 w-[18px] shrink-0" />
      )}
      {isDir && !isEmptyDir(node) && (
        <button
          type="button"
          tabIndex={-1}
          title={open ? "Collapse" : "Expand"}
          aria-label={open ? "Collapse folder" : "Expand folder"}
          onClick={(event) => {
            event.stopPropagation();
            handlers.onToggle(node.path);
          }}
          className="grid h-6 w-[18px] shrink-0 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]"
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
      )}
      {isDir ? (
        isHiddenDir(node) ? (
          <FolderDotIcon className={`size-3.5 shrink-0${dim ? " text-[var(--text-faint)]" : ""}`} />
        ) : open ? (
          <FolderOpenIcon className={`size-3.5 shrink-0${dim ? " text-[var(--text-faint)]" : ""}`} />
        ) : (
          <FolderIcon className={`size-3.5 shrink-0${dim ? " text-[var(--text-faint)]" : ""}`} />
        )
      ) : (
        <FileTextIcon className="size-4 shrink-0 text-[var(--text-faint)]" />
      )}
      {renaming ? (
        <RenameInput
          initial={innerName}
          onCommit={(name) => handlers.onRename(target, name)}
          onCancel={handlers.onCancelRename}
        />
      ) : (
        <span
          className={`min-w-0 flex-1 truncate ${
            isDir || selected ? "font-medium" : ""
          } ${dim ? "text-[var(--text-faint)]" : isDir ? "text-[var(--text)]" : ""}`}
        >
          {node.label ? rowLabel(node) : fileName}
        </span>
      )}
      {changed && !renaming && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
          title="Changed on disk"
          data-changed-dot
        />
      )}
      {!renaming && (
        <DotsButton node={node} visible={selected} onMenu={handlers.onMenu} />
      )}
    </div>
  );
}

/**
 * A Place's header: the folder's name in bold, a plus for a new note in it, and
 * its menu. What is inside it sits at the same indent below, like a section.
 */
function PlaceRow({
  node,
  open,
  selected,
  focused,
  highlighted,
  handlers,
}: {
  node: TreeNode;
  open: boolean;
  selected: boolean;
  focused: boolean;
  highlighted: boolean;
  handlers: Handlers;
}) {
  const empty = isEmptyDir(node);
  const tone = selected
    ? "bg-[var(--bg-active)]"
    : `hover:bg-[var(--bg-hover)]${highlighted ? " bg-[var(--bg-hover)]" : ""}`;
  return (
    <div
      data-tree-row={node.path}
      data-kind="dir"
      data-place
      data-active={selected}
      tabIndex={focused ? 0 : -1}
      onMouseDown={focusUnlessControl}
      onFocus={() => handlers.onFocusRow(node.path)}
      onClick={() => handlers.onOpenFolder(node)}
      onDoubleClick={(event) => {
        if (empty || (event.target as HTMLElement).closest("button")) return;
        handlers.onToggle(node.path);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        handlers.onMenu(node, event.clientX, event.clientY);
      }}
      style={{ paddingLeft: 5 }}
      className={`group/row relative flex h-8 cursor-default items-center gap-2 rounded-[var(--radius)] pr-2 text-[13px] text-[var(--text-muted)] outline-none ${
        focused && handlers.keyboardRing ? "tree-ring" : ""} ${tone}`}
    >
      {empty ? (
        <span aria-hidden className="h-6 w-[18px] shrink-0" />
      ) : (
        <button
          type="button"
          tabIndex={-1}
          title={open ? "Collapse" : "Expand"}
          aria-label={open ? "Collapse place" : "Expand place"}
          onClick={(event) => {
            event.stopPropagation();
            handlers.onToggle(node.path);
          }}
          className="grid h-6 w-[18px] shrink-0 place-items-center rounded hover:bg-[var(--bg-active)] hover:text-[var(--text)]"
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
      )}
      <FolderRootIcon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-[var(--text)]">{node.name}</span>
        {node.hint && <span className="ml-1.5 text-[var(--text-faint)]">{node.hint}</span>}
        {node.missing && (
          <span data-place-missing className="ml-1.5 text-[var(--text-faint)]">
            Not found
          </span>
        )}
      </span>
      {!node.missing && (
        <button
          type="button"
          tabIndex={-1}
          title={`New file in ${node.name}`}
          aria-label={`New file in ${node.name}`}
          data-place-new
          onClick={(event) => {
            event.stopPropagation();
            handlers.onNewNote(node.path);
          }}
          className="grid size-6 shrink-0 place-items-center rounded text-[var(--text-faint)] opacity-0 hover:bg-[var(--bg-active)] hover:text-[var(--text)] group-hover/row:opacity-100"
        >
          <PlusIcon className="size-3.5" />
        </button>
      )}
      <DotsButton node={node} visible={selected} onMenu={handlers.onMenu} />
    </div>
  );
}

export function FileTree({
  nodes,
  depth = 0,
  ...handlers
}: { nodes: TreeNode[]; depth?: number } & Handlers) {
  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const focused = node.path === handlers.tabbablePath;
        const highlighted = node.path === handlers.highlightPath;
        if (node.kind === "dir") {
          const open =
            !isEmptyDir(node) && (handlers.forceExpand || handlers.expanded.has(node.path));
          const selected =
            handlers.folderPage !== null &&
            (handlers.folderPage === node.path ||
              handlers.folderPage === node.openPath);
          if (node.place) {
            // What is inside a Place indents under its header, with the same
            // guide line a folder's contents have, so the Place reads as the
            // root of what is below it.
            return (
              <div key={node.path} data-place-group>
                <PlaceRow
                  node={node}
                  open={open}
                  selected={selected}
                  focused={focused}
                  highlighted={highlighted}
                  handlers={handlers}
                />
                {open && node.children && (
                  <div
                    className="tree-children mt-0.5"
                    style={{ "--depth": depth + 1 } as React.CSSProperties}
                  >
                    <FileTree nodes={node.children} depth={depth + 1} {...handlers} />
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={node.path}>
              <Row
                node={node}
                open={open}
                selected={selected}
                focused={focused}
                highlighted={highlighted}
                depth={depth}
                handlers={handlers}
              />
              {open && node.children && (
                <div
                  className="tree-children mt-0.5"
                  style={{ "--depth": depth + 1 } as React.CSSProperties}
                >
                  <FileTree nodes={node.children} depth={depth + 1} {...handlers} />
                </div>
              )}
            </div>
          );
        }
        return (
          <Row
            key={node.path}
            node={node}
            open={false}
            selected={node.path === handlers.activePath}
            focused={focused}
            highlighted={highlighted}
            depth={depth}
            handlers={handlers}
          />
        );
      })}
    </div>
  );
}
