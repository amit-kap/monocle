# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.

## Open issues

- [ ] **Finder "Open With" doesn't load the file** — picking Monocle from Open
  With launches the app but ignores the document. Needs Rust `RunEvent::Opened`
  handling routed to the UI, plus a rule for files outside the chosen root
  folder. (macOS integration)
- [ ] **Block drag reliability** — custom pointer drag + sticky hover implemented;
  still needs real-world confirmation that grabbing is consistent. (editor)
- [ ] **No caret on note open** — auto-focus was removed to stop the scroll jump,
  so opening a note leaves no caret until you click. (editor)
- [ ] **Markdown round-trip fixtures** — tests for headings, nested lists, tasks,
  code, quotes, links are still not written. (testing)
- [ ] **Stale plan** — `plan.md` §7 non-goals and §11 decision 1 still say "flat
  sidebar / flat list", but a recursive tree ships. (docs)
- [ ] **Noisy-but-benign logs** — `readDir failed` for protected dirs (e.g. Photos
  Library) and the `IPC custom protocol failed … postMessage` warning. (cleanup)
- [ ] **Version not surfaced** — no version/About anywhere in the UI. (polish)

## Deferred features

- [ ] Autosave (currently explicit `⌘S` only).
- [ ] External file-change watching (e.g. `notify`).
- [ ] Multiple windows / tabs.
- [ ] Inline image upload.
- [ ] Tables, databases, kanban, embeds.
- [ ] Wiki-style `[[links]]` and backlinks.
- [ ] Code signing & notarization (not distributing yet).
- [ ] Windows / Linux builds.

## Done (recent)

- [x] Custom app icon.
- [x] `.md` / `.markdown` file association (`CFBundleDocumentTypes`) + LaunchServices registration.
- [x] Editable inline note title that renames the file (extension preserved).
- [x] Sidebar resizable (persisted width) + refresh button.
- [x] Block type label shown beside the hover handle.
- [x] Editor layout: removed dead top strip, top/bottom padding balanced.
