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

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
