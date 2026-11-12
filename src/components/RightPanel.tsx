import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { RIGHT_TABS, type RightTab } from "../types";
import { RIGHT_PANEL, clampWidth, readWidth, storeWidth } from "../lib/layout";
import { parseHeadings } from "../lib/outline";
import { estimateTokens, formatTokens } from "../lib/tokens";
import { changedHunks, diffLines, diffStats } from "../lib/diff";
import { linkedFiles, linkedFrom, runChecks, type Check } from "../lib/context";
import { pathExists, readNote } from "../lib/fs";
import { timeAgo } from "../lib/time";
import { baseName } from "../lib/treeView";
import { PaneToggle } from "./PaneToggle";
import { ResizeHandle } from "./ResizeHandle";

const TAB_LABEL: Record<RightTab, string> = {
  outline: "Outline",
  context: "Context",
  changes: "Changes",
};

const EMPTY: Record<RightTab, string> = {
  outline: "Open a note to see its headings.",
  context: "Open a note to see what an agent loads with it.",
  changes: "Open a note to see changes made outside the app.",
};

function Caption({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex h-[26px] items-center text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)]">
      <span className="flex-1">{left}</span>
      {right}
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col border-t border-[var(--border)] px-5 pb-[18px] pt-4 first:border-t-0">
      {children}
    </div>
  );
}

/** Headings with the tokens in each section, and the problems found in the note. */
function OutlineTab() {
  const liveText = useStore((s) => s.liveText);
  const activePath = useStore((s) => s.activePath);
  const goToHeading = useStore((s) => s.goToHeading);
  const headings = useMemo(() => parseHeadings(liveText), [liveText]);
  const [checks, setChecks] = useState<Check[]>([]);

  useEffect(() => {
    if (!activePath) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void runChecks(liveText, activePath, pathExists).then((found) => {
        if (!cancelled) setChecks(found);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [liveText, activePath]);

  const smallest = headings.length
    ? Math.min(...headings.map((h) => h.level))
    : 1;

  return (
    <>
      <Block>
        <Caption left="SECTIONS" right="≈ TOKENS" />
        {headings.length === 0 && (
          <p className="text-[13px] text-[var(--text-faint)]">
            No headings yet.
          </p>
        )}
        {headings.map((heading) => (
          <button
            key={`${heading.index}:${heading.line}`}
            type="button"
            data-outline-item
            onClick={() => goToHeading(heading.line, heading.index)}
            style={{ marginLeft: (heading.level - smallest) * 10 }}
            className="flex min-h-7 w-auto items-center border-l-2 border-[var(--border)] pl-3 text-left text-[13px] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <span className="flex-1 truncate">{heading.title}</span>
            <em className="ml-2 text-[12px] not-italic tabular-nums text-[var(--text-muted)]">
              {formatTokens(heading.tokens)}
            </em>
          </button>
        ))}
      </Block>
      <Block>
        <Caption left="CHECKS" right={String(checks.length)} />
        {checks.length === 0 && (
          <p className="text-[13px] text-[var(--text-muted)]">
            No problems found.
          </p>
        )}
        {checks.map((check, i) => (
          <div
            key={`${check.message}:${i}`}
            data-check
            className="mt-2 flex gap-2 text-[13px] leading-5"
          >
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <div>
              {check.message}
              {check.section && (
                <small className="block text-[12px] leading-[18px] text-[var(--text-muted)]">
                  {check.section}
                </small>
              )}
            </div>
          </div>
        ))}
      </Block>
    </>
  );
}

/** What an agent loads with this file: its tokens, the files it links to, who links here. */
function ContextTab() {
  const activePath = useStore((s) => s.activePath);
  const liveText = useStore((s) => s.liveText);
  const notes = useStore((s) => s.notes);
  const [linked, setLinked] = useState<{ path: string; tokens: number }[]>([]);
  const [backlinks, setBacklinks] = useState<string[]>([]);
  const own = estimateTokens(liveText);
  const linkKey = activePath
    ? linkedFiles(liveText, activePath).join("\n")
    : "";

  useEffect(() => {
    if (!activePath) return;
    let cancelled = false;
    const paths = linkKey ? linkKey.split("\n") : [];
    void Promise.all(
      paths.map(async (path) => {
        try {
          // A link to a file that is not there loads nothing.
          if (!(await pathExists(path))) return null;
          return { path, tokens: estimateTokens(await readNote(path)) };
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (!cancelled)
        setLinked(
          rows.filter((r): r is { path: string; tokens: number } => r !== null),
        );
    });
    return () => {
      cancelled = true;
    };
  }, [activePath, linkKey]);

  // Who links here needs every note read once; it follows the file, not the keystrokes.
  useEffect(() => {
    if (!activePath) return;
    let cancelled = false;
    void (async () => {
      const texts = new Map<string, string>();
      for (const note of notes.slice(0, 400)) {
        if (note.path === activePath) continue;
        try {
          texts.set(note.path, await readNote(note.path));
        } catch {
          // Unreadable: it cannot be said to link here.
        }
      }
      if (!cancelled) setBacklinks(linkedFrom(texts, activePath));
    })();
    return () => {
      cancelled = true;
    };
  }, [activePath, notes]);

  if (!activePath) return null;
  const total = own + linked.reduce((sum, f) => sum + f.tokens, 0);

  return (
    <>
      <Block>
        <Caption left="WHAT AN AGENT LOADS" />
        <div className="flex min-h-7 items-center text-[13px]">
          <span className="flex-1 text-[var(--text-muted)]">This file</span>
          <span data-context-own className="tabular-nums">
            {formatTokens(own)}
          </span>
        </div>
        {linked.map((f) => (
          <div
            key={f.path}
            data-context-linked
            className="flex min-h-7 items-center text-[13px]"
          >
            <span className="flex-1 truncate text-[var(--text-muted)]">
              Linked: {baseName(f.path)}
            </span>
            <span className="tabular-nums">{formatTokens(f.tokens)}</span>
          </div>
        ))}
        <div className="flex min-h-7 items-center text-[13px]">
          <span className="flex-1 text-[var(--text-muted)]">Total</span>
          <b data-context-total className="tabular-nums">
            ≈ {formatTokens(total)}
          </b>
        </div>
      </Block>
      <Block>
        <Caption left="LINKED FROM" />
        {backlinks.length === 0 && (
          <p className="text-[13px] text-[var(--text-muted)]">
            No other file links here.
          </p>
        )}
        {backlinks.map((path) => (
          <div
            key={path}
            data-context-backlink
            className="min-h-7 truncate text-[13px] leading-7"
          >
            {baseName(path)}
          </div>
        ))}
      </Block>
      <Block>
        <Caption left="LOCATION" />
        <div className="break-all font-mono text-[12px] leading-[18px]">
          {activePath}
        </div>
      </Block>
    </>
  );
}

/** An outside edit to the open file: the lines that changed, and what to do about them. */
function ChangesTab() {
  const activePath = useStore((s) => s.activePath);
  const notice = useStore((s) =>
    s.activePath ? s.changes[s.activePath] : undefined,
  );
  const diskText = useStore((s) => s.diskText);
  const keepChange = useStore((s) => s.keepChange);
  const revertChange = useStore((s) => s.revertChange);

  const lines = useMemo(
    () =>
      notice && notice.before !== null
        ? changedHunks(diffLines(notice.before, notice.after))
        : [],
    [notice],
  );
  if (!activePath) return null;
  if (!notice) {
    return (
      <Block>
        <p className="text-[13px] text-[var(--text-muted)]">
          No changes since you opened this file.
        </p>
      </Block>
    );
  }
  const unsaved = diskText !== notice.after;

  return (
    <Block>
      <Caption left="CHANGED ON DISK" />
      <p className="text-[13px] leading-5">
        Edited outside the app {timeAgo(notice.at)}.
      </p>
      {unsaved && (
        <p className="mt-1 text-[12px] leading-[18px] text-[var(--text-muted)]">
          You have unsaved edits. Keep change loads the outside version and
          replaces them. Revert saves your edits over it.
        </p>
      )}
      <div
        data-diff
        className="my-2.5 whitespace-pre-wrap rounded-lg bg-[var(--bg-hover-strong)] px-2.5 py-2 font-mono text-[12px] leading-5"
      >
        {lines.length === 0 && (
          <span className="text-[var(--text-muted)]">
            No earlier version to compare.
          </span>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            data-diff-line={line.kind}
            className={
              line.kind === "add"
                ? "text-[#2f6b3a]"
                : line.kind === "del"
                  ? "text-[var(--danger)] line-through decoration-1"
                  : "text-[var(--text-muted)]"
            }
          >
            {line.kind === "add" ? "+ " : line.kind === "del" ? "− " : "  "}
            {line.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-keep-change
          onClick={() => void keepChange(activePath)}
          className="h-[26px] rounded-md border border-[var(--border-strong)] px-2.5 text-[12px] font-semibold hover:bg-[var(--bg-hover)]"
        >
          Keep change
        </button>
        <button
          type="button"
          data-revert-change
          onClick={() => void revertChange(activePath)}
          className="h-[26px] rounded-md border border-[var(--border-strong)] px-2.5 text-[12px] font-semibold hover:bg-[var(--bg-hover)]"
        >
          Revert
        </button>
      </div>
    </Block>
  );
}

/** Lines added and removed, for the status bar's notice. */
export function changeSummary(before: string | null, after: string): string {
  if (before === null) return "changed";
  const { added, removed } = diffStats(diffLines(before, after));
  const parts: string[] = [];
  if (added) parts.push(`${added} ${added === 1 ? "line" : "lines"} added`);
  if (removed)
    parts.push(`${removed} ${removed === 1 ? "line" : "lines"} removed`);
  return parts.join(", ") || "changed";
}

/**
 * The inspector on the right: Outline, Context and Changes. Resizable from its
 * left edge between 220 and 460px, and collapsible; both choices are remembered.
 */
export function RightPanel() {
  const open = useStore((s) => s.rightOpen);
  const tab = useStore((s) => s.rightTab);
  const toggleRight = useStore((s) => s.toggleRight);
  const setRightTab = useStore((s) => s.setRightTab);
  const activePath = useStore((s) => s.activePath);
  const hasChange = useStore((s) =>
    Boolean(s.activePath && s.changes[s.activePath]),
  );
  const [width, setWidth] = useState(() =>
    readWidth(RIGHT_PANEL, localStorage),
  );
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    storeWidth(RIGHT_PANEL, localStorage, width);
  }, [width]);

  function startResize(startX: number) {
    const startWidth = width;
    setResizing(true);
    function onMove(event: MouseEvent) {
      // The handle is on the left edge, so dragging left widens the panel.
      const next = startWidth - (event.clientX - startX);
      setWidth(clampWidth(next, RIGHT_PANEL.min, RIGHT_PANEL.max));
    }
    function onUp() {
      setResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <aside
      className="relative h-full shrink-0 bg-[var(--bg-sidebar)] motion-reduce:!transition-none"
      style={{
        width: open ? width : 0,
        visibility: open ? "visible" : "hidden",
        transition: resizing
          ? "none"
          : `width 200ms ease, visibility 0s linear ${open ? 0 : 200}ms`,
      }}
      aria-label="Inspector"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="h-full overflow-hidden">
        <div className="flex h-full flex-col" style={{ width }}>
          <div className="relative flex h-10 shrink-0 items-center gap-0.5 border-b border-[var(--border)] px-3">
            <div data-tauri-drag-region className="absolute inset-0" />
            <div role="tablist" className="relative flex items-center gap-0.5">
              {RIGHT_TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  data-tab={id}
                  onClick={() => setRightTab(id)}
                  className={`flex h-[26px] items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] ${
                    tab === id
                      ? "bg-[var(--bg-active)] font-semibold text-[var(--text)]"
                      : "font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                  }`}
                >
                  {TAB_LABEL[id]}
                  {id === "changes" && hasChange && (
                    <span
                      className="size-1.5 rounded-full bg-[var(--accent)]"
                      data-changes-dot
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <PaneToggle side="right" open onClick={toggleRight} />
            </div>
          </div>

          <div role="tabpanel" className="flex-1 overflow-y-auto">
            {!activePath ? (
              <Block>
                <p className="text-[13px] leading-5 text-[var(--text-faint)]">
                  {EMPTY[tab]}
                </p>
              </Block>
            ) : tab === "outline" ? (
              <OutlineTab />
            ) : tab === "context" ? (
              <ContextTab />
            ) : (
              <ChangesTab />
            )}
          </div>
        </div>
      </div>

      {open && (
        <ResizeHandle
          style={{ left: 0 }}
          onResizeStart={(event) => startResize(event.clientX)}
          onReset={() => setWidth(RIGHT_PANEL.default)}
        />
      )}
    </aside>
  );
}
