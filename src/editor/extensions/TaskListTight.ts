import { Extension } from "@tiptap/core";

// tiptap-markdown builds its serializer state with only `hardBreakNodeName`, so
// prosemirror-markdown never receives the `tightLists` option. Bullet and
// ordered lists stay tight anyway because MarkdownTightLists registers a
// `tight` attribute on them — but that list omits `taskList`, so a task list
// has no `tight` attribute, the serializer falls back to an undefined option,
// and every task comes out separated by a blank line. That makes the list
// loose and churns the file on every save.
//
// Registering the same attribute for taskList fixes it, and keeps an author's
// genuinely loose task list loose: markdown-it wraps loose items in <p>, which
// parseHTML detects.
export const TaskListTight = Extension.create({
  name: "taskListTight",

  addGlobalAttributes() {
    return [
      {
        types: ["taskList"],
        attributes: {
          tight: {
            default: true,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute("data-tight") === "true" ||
              !element.querySelector("p"),
            renderHTML: (attributes: Record<string, unknown>) => ({
              class: attributes.tight ? "tight" : null,
              "data-tight": attributes.tight ? "true" : null,
            }),
          },
        },
      },
    ];
  },
});