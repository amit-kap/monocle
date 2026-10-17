import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { SlashItem } from "../editor/slashItems";
import { scrollDelta } from "../lib/scroll";

export type SlashMenuHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

export const SlashMenu = forwardRef<
  SlashMenuHandle,
  SuggestionProps<SlashItem, SlashItem>
>(function SlashMenu(props, ref) {
  const [selected, setSelected] = useState(0);
  const items = props.items;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  useEffect(() => {
    // Arrow keys move the highlight, but the list scrolls independently, so the
    // selection walks off the bottom without this. Scrolling the container by a
    // delta keeps the page itself from moving.
    const menu = menuRef.current;
    const item = menu?.querySelector(".slash-menu-list")?.children[selected];
    if (!menu || !item) return;
    menu.scrollTop += scrollDelta(
      menu.getBoundingClientRect(),
      item.getBoundingClientRect(),
    );
  }, [selected, items]);

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
    <div className="slash-menu" ref={menuRef}>
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
