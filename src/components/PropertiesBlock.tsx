import { useState } from "react";
import { listItems, parseProperties, setProperty } from "../lib/frontmatter";

/**
 * The YAML frontmatter as a properties block under the title. Simple
 * `key: value` pairs are editable in place; values that span lines are shown
 * but edited in the source view, and every other character of the block is left
 * exactly as it was.
 */
export function PropertiesBlock({
  frontmatter,
  onChange,
}: {
  frontmatter: string;
  onChange: (next: string) => void;
}) {
  const props = parseProperties(frontmatter);
  const [editing, setEditing] = useState<number | null>(null);
  if (props.length === 0) return null;

  return (
    <div
      data-properties
      className="mb-5 flex flex-col border-b border-[var(--border)] pb-4 text-[13px] leading-5"
    >
      {props.map((prop) => {
        const items = listItems(prop.value);
        const asTags = items !== null && editing !== prop.line;
        return (
          <div key={prop.line} className="flex min-h-7 items-center">
            <span className="w-[110px] shrink-0 text-[var(--text-muted)]">{prop.key}</span>
            {!prop.editable ? (
              <span className="text-[var(--text-faint)]" title="Edit in the source view">
                {prop.value || "…"}
              </span>
            ) : asTags ? (
              <button
                type="button"
                data-prop-tags
                onClick={() => setEditing(prop.line)}
                className="flex flex-wrap items-center"
              >
                {items.map((item) => (
                  <span
                    key={item}
                    className="mr-1.5 inline-flex h-[22px] items-center rounded-[5px] bg-[var(--bg-hover-strong)] px-2 text-[12px] font-medium"
                  >
                    {item}
                  </span>
                ))}
              </button>
            ) : (
              <input
                data-prop-input
                aria-label={prop.key}
                defaultValue={prop.value}
                autoFocus={editing === prop.line}
                spellCheck={false}
                onBlur={(event) => {
                  setEditing(null);
                  if (event.currentTarget.value !== prop.value) {
                    onChange(setProperty(frontmatter, prop.line, event.currentTarget.value));
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.currentTarget.value = prop.value;
                    event.currentTarget.blur();
                  }
                }}
                className="min-w-0 flex-1 rounded px-1 py-0.5 outline-none hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
