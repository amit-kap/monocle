export type TreeNode = {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: TreeNode[];
};

export type NoteFile = {
  name: string;
  path: string;
};

export const RIGHT_TABS = ["outline", "context", "changes"] as const;
export type RightTab = (typeof RIGHT_TABS)[number];

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
