export type TreeNode = {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: TreeNode[];
  /** Files: size on disk in bytes, for the token estimate. */
  size?: number;
  /** Folders: whether a note sits inside, at any depth. Folders without are dimmed. */
  hasNotes?: boolean;
  /** Top-level rows only: a Place, one of the folders the sidebar is built from. */
  place?: boolean;
  /** Places: the parent folder, shown when two Places share a name. */
  hint?: string;
  /** Places: the folder can't be read (moved, deleted, or a drive that's gone). */
  missing?: boolean;
  /**
   * Set on a row that stands for several folders folded into one
   * (`Research / _feeds / 2026`), or for a folder folded into its only
   * `SKILL.md`. The names, outermost first.
   */
  label?: string[];
  /**
   * Folded folder rows: the innermost folder, which is the one the folder
   * page opens (`path` stays the outermost, which the chevron expands).
   */
  openPath?: string;
};

export type ChangeNotice = {
  /** The text before the outside edit, or null when we never saw it. */
  before: string | null;
  after: string;
  at: number;
};

export type ViewMode = "rich" | "source" | "split";

export type NoteFile = {
  name: string;
  path: string;
};

export const RIGHT_TABS = ["outline", "context", "changes"] as const;
export type RightTab = (typeof RIGHT_TABS)[number];

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
