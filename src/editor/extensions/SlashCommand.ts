import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SlashMenu, type SlashMenuHandle } from "../../components/SlashMenu";
import { slashItems, type SlashItem } from "../slashItems";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return slashItems
            .filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.keywords.some((keyword) => keyword.includes(q)),
            )
            .slice(0, 10);
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let component: ReactRenderer<
            SlashMenuHandle,
            SuggestionProps<SlashItem, SlashItem>
          > | null = null;
          let unmount: (() => void) | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                props,
                editor: props.editor,
              });
              unmount = props.mount(component.element);
            },
            onUpdate: (props) => component?.updateProps(props),
            onKeyDown: (props) => {
              if (props.event.key === "Escape") return false;
              return component?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              unmount?.();
              component?.destroy();
              component = null;
              unmount = null;
            },
          };
        },
      }),
    ];
  },
});
