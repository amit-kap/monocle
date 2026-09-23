import { useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { TreeNode } from "../types";

type Handlers = {
  activePath: string | null;
  selectedDir: string | null;
  expanded: Set<string>;
  forceExpand: boolean;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
  onAddNote: (path: string) => void;
  onRename: (path: string, name: string) => void;
  onDelete: (path: string) => void;
};

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v4a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 12h14M12 5v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderRow({
  node,
  depth,
  open,
  onToggle,
  onAddNote,
}: {
  node: TreeNode;
  depth: number;
  open: boolean;
  onToggle: (path: string) => void;
  onAddNote: (path: string) => void;
}) {
  return (
    <div
      onClick={() => onToggle(node.path)}
      className="group/folder flex cursor-default items-center gap-2 rounded-[var(--radius)] py-1.5 pr-2 text-[13px] hover:bg-[var(--bg-hover)]"
      style={{ paddingLeft: 8 + depth * 12 }}
    >
      <span className="flex shrink-0 items-center gap-1.5 text-[var(--text-muted)] group-hover/folder:text-[var(--text)]">
        <ChevronIcon
          className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <FolderIcon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
        {node.name}
      </span>
      <button
        type="button"
        title="New note"
        onClick={(event) => {
          event.stopPropagation();
          onAddNote(node.path);
        }}
        className="grid size-5 shrink-0 place-items-center rounded text-[var(--text-faint)] opacity-0 hover:bg-[var(--bg-active)] hover:text-[var(--text)] group-hover/folder:opacity-100"
      >
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  );
}

function FileRow({
  node,
  depth,
  active,
  onOpen,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  active: boolean;
  onOpen: (path: string) => void;
  onRename: (path: string, name: string) => void;
  onDelete: (path: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name);

  async function commit() {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== node.name) await onRename(node.path, name);
  }

  async function handleDelete() {
    const ok = await confirm(`Delete "${node.name}"? This cannot be undone.`, {
      title: "Delete note",
      kind: "warning",
    });
    if (ok) await onDelete(node.path);
  }

  return (
    <div
      onClick={() => !editing && onOpen(node.path)}
      data-active={active}
      className={`group/file flex cursor-default items-center gap-2 rounded-[var(--radius)] py-1.5 pr-2 text-[13px] ${
        active
          ? "bg-[var(--bg-active)] text-[var(--text)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
      }`}
      style={{ paddingLeft: 9 + depth * 12 }}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded border border-[var(--accent)] bg-[var(--bg)] px-1 py-0.5 text-[13px] text-[var(--text)] outline-none"
        />
      ) : (
        <>
          <FileIcon className="size-4 shrink-0 text-[var(--text-faint)] group-hover/file:text-[var(--text)]" />
          <span
            className="min-w-0 flex-1 truncate"
            onDoubleClick={() => {
              setDraft(node.name);
              setEditing(true);
            }}
          >
            {node.name}
          </span>
          <span
            className={`ml-auto flex items-center gap-0 ${
              active ? "opacity-100" : "opacity-0 group-hover/file:opacity-100"
            }`}
          >
            <button
              type="button"
              title="Rename"
              onClick={(event) => {
                event.stopPropagation();
                setDraft(node.name);
                setEditing(true);
              }}
              className="grid size-6 shrink-0 place-items-center rounded text-[var(--text-faint)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]"
            >
              <PencilIcon className="size-3.5" />
            </button>
            <button
              type="button"
              title="Delete"
              onClick={(event) => {
                event.stopPropagation();
                void handleDelete();
              }}
              className="grid size-6 shrink-0 place-items-center rounded text-[var(--text-faint)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </span>
        </>
      )}
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
        if (node.kind === "dir") {
          const open = handlers.forceExpand || handlers.expanded.has(node.path);
          return (
            <div key={node.path}>
              <FolderRow
                node={node}
                depth={depth}
                open={open}
                onToggle={handlers.onToggle}
                onAddNote={handlers.onAddNote}
              />
              {open && node.children && (
                <div className="tree-children ps-1.5">
                  <FileTree
                    nodes={node.children}
                    depth={depth + 1}
                    {...handlers}
                  />
                </div>
              )}
            </div>
          );
        }
        return (
          <FileRow
            key={node.path}
            node={node}
            depth={depth}
            active={node.path === handlers.activePath}
            onOpen={handlers.onOpen}
            onRename={handlers.onRename}
            onDelete={handlers.onDelete}
          />
        );
      })}
    </div>
  );
}