import { Fragment, useMemo } from "react";
import { useStore } from "../store/useStore";
import { baseName, findNode } from "../lib/treeView";
import { formatTokens, tokensFromBytes } from "../lib/tokens";
import { sortNodes } from "../lib/fs";
import type { TreeNode } from "../types";
import {
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderRootIcon,
  PlusIcon,
} from "./icons";

/**
 * A folder's page: its name, how much is in it, and its files and subfolders
 * to open. Reached by clicking a folder's name in the tree or the breadcrumb.
 */
export function FolderPage() {
  const folder = useStore((s) => s.folder);
  const folderPage = useStore((s) => s.folderPage);
  const tree = useStore((s) => s.tree);
  const openNote = useStore((s) => s.openNote);
  const openFolder = useStore((s) => s.openFolder);
  const setRoot = useStore((s) => s.setRoot);
  const createNote = useStore((s) => s.createNote);

  const children: TreeNode[] = useMemo(() => {
    if (!folderPage) return [];
    const list =
      folderPage === folder
        ? tree
        : (findNode(tree, folderPage)?.children ?? []);
    return sortNodes([...list]);
  }, [folder, folderPage, tree]);

  if (!folderPage) return null;

  const files = children.filter((node) => node.kind === "file");
  const tokens = files.reduce(
    (sum, node) => sum + tokensFromBytes(node.size ?? 0),
    0,
  );
  const isRoot = folderPage === folder;

  return (
    <div className="editor-scroll flex-1 overflow-y-auto" data-folder-page>
      <div className="mx-auto w-full max-w-[720px] px-10 py-10">
        <div className="flex items-end gap-2.5">
          <FolderOpenIcon className="mb-2 size-6 shrink-0 text-[var(--text-muted)]" />
          <h1 className="min-w-0 flex-1 truncate text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text)]">
            {baseName(folderPage)}
          </h1>
          {!isRoot && (
            <button
              type="button"
              onClick={() => void setRoot(folderPage)}
              className="flex h-8 shrink-0 outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)] items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-[12px] font-semibold text-[var(--text)] hover:bg-[var(--bg-hover)]"
            >
              <FolderRootIcon className="size-4" />
              Set as root folder
            </button>
          )}
          <button
            type="button"
            onClick={() => void createNote(folderPage)}
            className="flex h-8 shrink-0 outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)] items-center gap-1.5 rounded-[var(--radius)] bg-[var(--btn-primary-bg)] px-3 text-[12px] font-semibold text-[var(--btn-primary-fg)]"
          >
            <PlusIcon className="size-4" />
            New file
          </button>
        </div>
        <p className="mb-4 mt-1.5 text-[13px] text-[var(--text-muted)]">
          {children.length} {children.length === 1 ? "item" : "items"}
          {tokens > 0
            ? ` · ≈ ${formatTokens(tokens)} tokens in files here`
            : ""}
        </p>
        <div>
          {children.map((node, i) => (
            <Fragment key={node.path}>
              {i > 0 && (
                <hr className="border-0 border-t border-[var(--border)]" />
              )}
              <button
                type="button"
                data-folder-row={node.path}
                onClick={() =>
                  node.kind === "dir"
                    ? void openFolder(node.path)
                    : void openNote(node.path)
                }
                className="flex min-h-[60px] w-full items-center gap-4 rounded-[var(--radius)] px-3 text-left hover:bg-[var(--bg-hover)]"
              >
                {node.kind === "dir" ? (
                  <FolderIcon className="size-4 shrink-0 text-[var(--text-muted)]" />
                ) : (
                  <FileTextIcon className="size-4 shrink-0 text-[var(--text-muted)]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[var(--text)]">
                    {node.name}
                  </span>
                  <span className="block text-[13px] text-[var(--text-muted)]">
                    {node.kind === "dir" ? "Folder" : "Markdown file"}
                  </span>
                </span>
                {node.kind === "file" && (
                  <span className="text-[13px] tabular-nums text-[var(--text-muted)]">
                    ≈ {formatTokens(tokensFromBytes(node.size ?? 0))}
                  </span>
                )}
              </button>
            </Fragment>
          ))}
          {children.length === 0 && (
            <p className="px-3 py-4 text-[13px] text-[var(--text-faint)]">
              Nothing here yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
