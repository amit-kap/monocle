import { Editor } from "@tiptap/core";
import { appExtensions } from "./extensions";

// The same stack EditorPane mounts, so round-trip fixtures exercise what ships.
export function makeTestEditor(content = ""): Editor {
  return new Editor({ extensions: appExtensions, content });
}

/**
 * What lands on disk for a given markdown body. `toMarkdown` appends the
 * trailing newline, so expectations are written without it and wrapped here.
 */
export function onDisk(markdown: string): string {
  if (markdown.length === 0 || markdown.endsWith("\n")) return markdown;
  return `${markdown}\n`;
}