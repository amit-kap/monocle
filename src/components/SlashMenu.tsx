import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { SlashItem } from "../editor/slashItems";

export type SlashMenuHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

export const SlashMenu = forwardRef<
  SlashMenuHandle,
  SuggestionProps<SlashItem, SlashItem>
>(function SlashMenu(props, ref) {
  const [selected, setSelected] = useState(0);
  const items = props.items;

  useEffect(() => {
    setSelected(0);
  }, [items]);

  function selectItem(index: number) {
    const item = items[index];
    if (item) props.command(item);
  }

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((current) => (current + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((current) => (current + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selected);
          return true;
        }
        return false;
      },
    }),
    [items, selected],
  );

  if (items.length === 0) return null;

  return (
    <div className="slash-menu">
      <div className="slash-menu-label">Basic blocks</div>
      <div className="slash-menu-list">
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onMouseEnter={() => setSelected(index)}
            onClick={() => selectItem(index)}
            className={`slash-menu-item${index === selected ? " is-selected" : ""}`}
          >
            {item.icon}
            <span>{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
