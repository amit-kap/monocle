import { Editor } from "@tiptap/core";
import { appExtensions } from "./extensions";

// The same stack EditorPane mounts, so round-trip fixtures exercise what ships.
export function makeTestEditor(content = ""): Editor {
  return new Editor({ extensions: appExtensions, content });
}