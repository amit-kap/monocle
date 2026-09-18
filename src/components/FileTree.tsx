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
  onRename: (path: string, name: string) => void;
  onDelete: (path: string) => void;
};

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 2.5h5l3 3v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9 2.5v3h3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11.1 2.9a1.3 1.3 0 0 1 1.9 1.9l-6.6 6.6-2.5.6.6-2.5 6.6-6.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4.5h10M6.5 4.5V3.4A.9.9 0 0 1 7.4 2.5h1.2a.9.9 0 0 1 .9.9v1.1M4.2 4.5l.6 8a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8"
        stroke="currentColor"
        strokeWidth="1.3"
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
  selected,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  open: boolean;
  selected: boolean;
  onToggle: (path: string) => void;
}) {
  return (
    <div
      onClick={() => onToggle(node.path)}
      className={`flex h-7 cursor-default items-center gap-1 rounded-[var(--radius)] pr-2 text-[13px] ${
        selected
          ? "bg-[var(--bg-hover)] text-[var(--text)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
      }`}
      style={{ paddingLeft: 6 + depth * 14 }}
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center transition-transform ${
          open ? "rotate-90" : ""
        }`}
      >
        <ChevronIcon />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
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
      className={`group flex h-7 cursor-default items-center gap-1 rounded-[var(--radius)] pr-2 text-[13px] ${
        active
          ? "bg-[var(--bg-active)] text-[var(--text)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
      }`}
      style={{ paddingLeft: 6 + depth * 14 }}
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
          <span className="grid h-4 w-4 shrink-0 place-items-center text-[var(--text-faint)]">
            <FileIcon />
          </span>
          <span
            className="min-w-0 flex-1 truncate"
            onDoubleClick={() => {
              setDraft(node.name);
              setEditing(true);
            }}
          >
            {node.name}
          </span>
          <button
            type="button"
            title="Rename"
            onClick={(event) => {
              event.stopPropagation();
              setDraft(node.name);
              setEditing(true);
            }}
            className="hidden h-5 w-5 shrink-0 place-items-center rounded text-[var(--text-faint)] hover:bg-[var(--bg-active)] hover:text-[var(--text)] group-hover:grid"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={(event) => {
              event.stopPropagation();
              void handleDelete();
            }}
            className="hidden h-5 w-5 shrink-0 place-items-center rounded text-[var(--text-faint)] hover:bg-[var(--bg-active)] hover:text-[var(--text)] group-hover:grid"
          >
            <TrashIcon />
          </button>
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
    <>
      {nodes.map((node) => {
        if (node.kind === "dir") {
          const open = handlers.forceExpand || handlers.expanded.has(node.path);
          return (
            <div key={node.path}>
              <FolderRow
                node={node}
                depth={depth}
                open={open}
                selected={node.path === handlers.selectedDir}
                onToggle={handlers.onToggle}
              />
              {open && node.children && (
                <FileTree nodes={node.children} depth={depth + 1} {...handlers} />
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
    </>
  );
}
