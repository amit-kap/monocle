import type { ReactNode } from "react";
import type { TurnIntoKind } from "../editor/blockUtils";

/** A fixed 18px slot for every item's icon, so the labels line up. */
export function GlyphIcon({ children }: { children: string }) {
  return <span className="block-menu-icon block-menu-glyph">{children}</span>;
}

export function LineIcon({ children }: { children: ReactNode }) {
  return (
    <span className="block-menu-icon">
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </span>
  );
}

export function BlockTypeIcon({ kind }: { kind: TurnIntoKind }) {
  switch (kind) {
    case "paragraph":
      return (
        <LineIcon>
          <path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5" />
        </LineIcon>
      );
    case 1:
      return <GlyphIcon>H1</GlyphIcon>;
    case 2:
      return <GlyphIcon>H2</GlyphIcon>;
    case 3:
      return <GlyphIcon>H3</GlyphIcon>;
    case 4:
    case 5:
    case 6:
      return <GlyphIcon>{`H${kind}`}</GlyphIcon>;
    case "bulletList":
      return (
        <LineIcon>
          <path d="M6 4h7.5M6 8h7.5M6 12h7.5" />
          <circle cx="3" cy="4" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="3" cy="8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="3" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </LineIcon>
      );
    case "orderedList":
      return <GlyphIcon>1.</GlyphIcon>;
    case "taskList":
      return (
        <LineIcon>
          <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.4" />
          <path d="m5.4 8.2 1.9 1.9 3.6-4" />
        </LineIcon>
      );
    case "blockquote":
      return (
        <LineIcon>
          <path d="M3.6 3v10M7 4.5h6M7 8h6M7 11.5h3.5" />
        </LineIcon>
      );
    case "codeBlock":
      return <GlyphIcon>{"</>"}</GlyphIcon>;
    case "divider":
      return (
        <LineIcon>
          <path d="M2.5 8h11" />
        </LineIcon>
      );
  }
}


/** Blocks the slash menu inserts that the block menu does not turn into. */
export function TableIcon() {
  return (
    <LineIcon>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M6.5 6.5V13" />
    </LineIcon>
  );
}

export function ImageIcon() {
  return (
    <LineIcon>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1" />
      <path d="M13.5 10.5l-3-3-6 5.5" />
    </LineIcon>
  );
}

export function FootnoteIcon() {
  return (
    <LineIcon>
      <path d="M2.5 12.5l4-7M6.5 12.5l-4-7" />
      <path d="M10.5 4.5l1.5-1v4.5" />
    </LineIcon>
  );
}
