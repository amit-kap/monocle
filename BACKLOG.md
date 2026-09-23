# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.

## Open issues

- [ ] **Block drag reliability** — custom pointer drag + sticky hover implemented;
  still needs real-world confirmation that grabbing is consistent. (editor)
- [ ] **No caret on note open** — auto-focus was removed to stop the scroll jump,
  so opening a note leaves no caret until you click. (editor)
- [ ] **Markdown round-trip fixtures** — tests for headings, nested lists, tasks,
  code, quotes, links are still not written. (testing)
- [ ] **Noisy-but-benign logs** — `readDir failed` for protected dirs (e.g. Photos
  Library) and the `IPC custom protocol failed … postMessage` warning. (cleanup)
- [ ] **Version not surfaced** — no version/About anywhere in the UI. (polish)
- [ ] **Red close button doesn't quit** — clicking the red 'X' on the app frame
  does not close the app. (macOS integration)

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

- [x] Open `.md` files from Finder via "Open With" — Rust `RunEvent::Opened` is
  routed to the UI (with a cold-start buffer); files outside the current root
  switch the workspace to their folder and open selected. (macOS integration)
- [x] Appearance selector (System / Light / Dark) in a custom overlay title bar;
  choice persists and syncs the native Tauri theme. (UI)
- [x] File tree restyle: folder/file icons, taller rows, hover actions, expand
  animation; folder-hover "new note" action. (UI)
- [x] Search toggle in the sidebar header (⌘P opens, Esc closes). (UI)
- [x] Custom app icon.
- [x] `.md` / `.markdown` file association (`CFBundleDocumentTypes`) + LaunchServices registration.
- [x] Editable inline note title that renames the file (extension preserved).
- [x] Sidebar resizable (persisted width) + refresh button.
- [x] Block type label shown beside the hover handle.
- [x] Editor layout: removed dead top strip, top/bottom padding balanced.
