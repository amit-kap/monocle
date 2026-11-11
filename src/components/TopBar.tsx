import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { crumbTrail } from "../lib/treeView";
import { cursorHeadingIndex } from "../lib/editorBuffer";
import { bufferMarkdown } from "../lib/editorBuffer";
import { parseHeadings, sectionText } from "../lib/outline";
import { copyFullContents, pathReferenceFor } from "../lib/agentActions";
import { formatTokens, estimateTokens } from "../lib/tokens";
import type { ViewMode } from "../types";
import { PaneToggle } from "./PaneToggle";
import { ChevronDown, CodeXmlIcon, Columns2Icon, CopyIcon, TypeIcon } from "./icons";

const VIEWS: { id: ViewMode; title: string; icon: typeof TypeIcon }[] = [
  { id: "rich", title: "Rich text", icon: TypeIcon },
  { id: "source", title: "Markdown source", icon: CodeXmlIcon },
  { id: "split", title: "Side by side", icon: Columns2Icon },
];

/**
 * The bar above the note: the breadcrumb on the left; on the right the view
 * switch, the copy-for-agent menu and the panel toggles. While a side pane is
 * shut its toggle lives here, at the spot it had inside the pane.
 */
export function TopBar({ trailing }: { trailing?: React.ReactNode }) {
  const folder = useStore((s) => s.folder);
  const home = useStore((s) => s.home);
  const activePath = useStore((s) => s.activePath);
  const folderPage = useStore((s) => s.folderPage);
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const toggleLeft = useStore((s) => s.toggleLeft);
  const toggleRight = useStore((s) => s.toggleRight);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const openFolder = useStore((s) => s.openFolder);
  const liveText = useStore((s) => s.liveText);

  const target = activePath ?? folderPage ?? folder;
  const trail = folder && target ? crumbTrail(folder, target) : null;

  const [copyOpen, setCopyOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [sectionName, setSectionName] = useState("Top of the file");
  const [copied, setCopied] = useState<string | null>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!copyOpen) return;
    function onDown(event: MouseEvent) {
      if (!copyRef.current?.contains(event.target as Node)) setCopyOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCopyOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [copyOpen]);

  // What the menu will copy depends on the file and on where the cursor is, so
  // it is worked out when the menu opens.
  useEffect(() => {
    if (!copyOpen || !activePath || !home) return;
    let cancelled = false;
    void pathReferenceFor(activePath, home).then((ref) => {
      if (!cancelled) setReference(ref);
    });
    const headings = parseHeadings(liveText);
    const index = cursorHeadingIndex();
    setSectionName(headings[index]?.title ?? "Top of the file");
    return () => {
      cancelled = true;
    };
  }, [copyOpen, activePath, home, liveText]);

  const tokens = useMemo(() => estimateTokens(liveText), [liveText]);

  function flash(label: string) {
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function copy(kind: "path" | "full" | "section") {
    setCopyOpen(false);
    if (!activePath) return;
    try {
      if (kind === "path") {
        await navigator.clipboard.writeText(reference);
        flash("Copied path");
      } else if (kind === "full") {
        await copyFullContents(activePath, bufferMarkdown() ?? liveText);
        flash("Copied contents");
      } else {
        const text = bufferMarkdown() ?? liveText;
        const headings = parseHeadings(text);
        const index = cursorHeadingIndex();
        await navigator.clipboard.writeText(
          index >= 0 ? sectionText(text, headings, index) : text,
        );
        flash("Copied section");
      }
    } catch {
      flash("Copy failed");
    }
  }

  const isNote = Boolean(activePath);

  return (
    <div
      className="relative flex h-10 shrink-0 items-center gap-2 border-b border-[var(--border)] pr-3"
      // With the sidebar shut the traffic lights sit over this bar, so the bar
      // makes room for them, and the sidebar toggle takes the spot it had
      // inside the sidebar.
      style={{ paddingLeft: leftOpen ? 16 : 84 }}
    >
      <div data-tauri-drag-region className="absolute inset-0" />
      {!leftOpen && (
        <div className="relative">
          <PaneToggle side="left" open={false} onClick={toggleLeft} />
        </div>
      )}

      <nav
        aria-label="Breadcrumb"
        data-breadcrumb
        className="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap text-[13px] text-[var(--text-muted)]"
      >
        {trail?.parts.map((part, index) => {
          const last = index === trail.parts.length - 1;
          return (
            <span key={`${part.path}:${index}`} className="flex min-w-0 items-center gap-1">
              {last ? (
                <b className="truncate font-semibold text-[var(--text)]">{part.name}</b>
              ) : trail.inside ? (
                <button
                  type="button"
                  onClick={() => void openFolder(part.path)}
                  className="truncate rounded px-1 hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                >
                  {part.name}
                </button>
              ) : (
                <span className="truncate">{part.name}</span>
              )}
              {!last && <span aria-hidden>/</span>}
            </span>
          );
        })}
        {!trail && <b className="font-semibold text-[var(--text)]">Monocle</b>}
      </nav>

      {copied && (
        <span role="status" className="relative text-[12px] text-[var(--text-muted)]">
          {copied}
        </span>
      )}

      <div className="relative flex h-10 items-center gap-1">
        {isNote && (
          <div
            role="group"
            aria-label="View"
            className="flex rounded-[7px] bg-[var(--bg-hover-strong)] p-0.5"
          >
            {VIEWS.map(({ id, title, icon: Glyph }) => (
              <button
                key={id}
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={view === id}
                data-view={id}
                onClick={() => setView(id)}
                className={`grid h-6 w-[30px] place-items-center rounded-[5px] ${
                  view === id
                    ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Glyph className="size-3.5" />
              </button>
            ))}
          </div>
        )}
        {isNote && (
          <div ref={copyRef} className="relative">
            <button
              type="button"
              title="Copy for agent"
              aria-label="Copy for agent"
              aria-haspopup="menu"
              aria-expanded={copyOpen}
              data-copy-button
              onClick={() => setCopyOpen((v) => !v)}
              className="flex h-7 items-center gap-0.5 rounded-[7px] pl-2 pr-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            >
              <CopyIcon />
              <ChevronDown className="size-3" />
            </button>
            {copyOpen && (
              <div
                role="menu"
                data-copy-menu
                className="block-menu"
                style={{ position: "absolute", right: 0, top: 32, width: 290, zIndex: 40 }}
              >
                <div className="block-menu-label">Copy for agent</div>
                <button
                  type="button"
                  role="menuitem"
                  className="block-menu-item"
                  onClick={() => void copy("path")}
                >
                  <span className="min-w-0">
                    Path reference
                    <code className="block truncate font-mono text-[11px] text-[var(--accent)]">
                      {reference}
                    </code>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block-menu-item"
                  onClick={() => void copy("full")}
                >
                  <span className="min-w-0">
                    Full contents
                    <span className="block text-[11px] text-[var(--text-faint)]">
                      Wrapped with the filename · ≈ {formatTokens(tokens)} tokens
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block-menu-item"
                  onClick={() => void copy("section")}
                >
                  <span className="min-w-0">
                    Current section
                    <span className="block truncate text-[11px] text-[var(--text-faint)]">
                      {sectionName}
                    </span>
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
        {trailing}
        {!rightOpen && <PaneToggle side="right" open={false} onClick={toggleRight} />}
      </div>
    </div>
  );
}
