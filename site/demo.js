(() => {
  const FILES = {
    "AGENTS.md": `# AGENTS.md

Rules for every agent working in this repo. Read this first.

## Working rules

- Plan before you code. Write the plan to \`plans/\`.
- Keep changes small and reviewable.
- Write findings and decisions to \`notes/\`, not into chat.
- Never edit files outside this repo.

## Commands

\`\`\`sh
npm install
npm run dev
npm test
\`\`\`

> If a rule here conflicts with a task, stop and ask.`,
    "CLAUDE.md": `# CLAUDE.md

Project context for Claude Code.

## Stack

- Tauri v2, React, TypeScript
- TipTap block editor
- Tailwind v4

## Conventions

- Components live in \`src/components\`.
- Every new block gets a round-trip test.
- Commit messages are short and in the imperative.`,
    "plans/refactor-sidebar.md": `# Refactor the sidebar

Split the file tree into smaller parts so each one can be tested alone.

## Steps

- [x] Read the tree code
- [x] Extract the row component
- [ ] Add keyboard navigation
- [ ] Write tests for folder state

## Open questions

| Question | Owner | Status |
| --- | --- | --- |
| Keep folder state on reload? | You | Open |
| Virtualise long lists? | Agent | Researching |
| Drop the refresh button? | You | Decided: keep |`,
    "plans/release-0.5.md": `# Release 0.5

## Checklist

- [x] Bump the version
- [x] Update the changelog
- [ ] Build the DMG
- [ ] Test the first-launch flow
- [ ] Publish to GitHub Releases

## Notes

The build is **not signed** yet. First launch needs right-click, then Open.`,
    "notes/search-ideas.md": `# Search ideas

Agent notes from Tuesday's session.

## Findings

- Match file names first, then content.
- Folder names should match too, so \`plans\` finds everything inside it.
- A clear button matters more than a filter menu.

## Suggested next step

Add \`⌘P\` as the one way in, and keep results to ten rows.`,
    "notes/decisions.md": `# Decisions

## 2026-11-05

Landing page says one thing: *a Markdown editor for your agents' files*.

## 2026-10-30

Appearance controls stay disabled while no note is open.

## 2026-10-29

Dropped the save-status label. Autosave closes the gap in under a second.`,
    "skills/code-review.md": `# Skill: code review

Use when asked to review a diff.

## Steps

1. Read the diff end to end.
2. List risks, most serious first.
3. For each risk, say what breaks and how to reproduce it.
4. Skip style nits unless they hide a bug.

## Output

A numbered list. No summary of what the diff does.`,
  };
  const TREE = [
    "AGENTS.md", "CLAUDE.md",
    ["plans", ["plans/refactor-sidebar.md", "plans/release-0.5.md"]],
    ["notes", ["notes/search-ideas.md", "notes/decisions.md"]],
    ["skills", ["skills/code-review.md"]],
  ];

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  function render(md) {
    const lines = md.split("\n"); let out = "", i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) {
        const code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++; out += `<pre><code>${esc(code.join("\n"))}</code></pre>`; continue;
      }
      if (/^# /.test(l)) { out += `<h1>${inline(l.slice(2))}</h1>`; i++; continue; }
      if (/^## /.test(l)) { out += `<h2>${inline(l.slice(3))}</h2>`; i++; continue; }
      if (/^> /.test(l)) { out += `<blockquote>${inline(l.slice(2))}</blockquote>`; i++; continue; }
      if (/^\|/.test(l)) {
        const rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const head = cells(rows[0]), body = rows.slice(2).map(cells);
        out += `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        continue;
      }
      if (/^(- |\d+\. )/.test(l)) {
        const items = [];
        while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) items.push(lines[i++]);
        const ordered = /^\d/.test(items[0]);
        out += `<${ordered ? "ol" : "ul"}>` + items.map((it) => {
          const t = it.replace(/^(- |\d+\. )/, ""), m = t.match(/^\[( |x)\] (.*)/);
          return m
            ? `<li class="todo${m[1] === "x" ? " done" : ""}"><input type="checkbox"${m[1] === "x" ? " checked" : ""}><div>${inline(m[2])}</div></li>`
            : `<li>${inline(t)}</li>`;
        }).join("") + `</${ordered ? "ol" : "ul"}>`;
        continue;
      }
      if (l.trim() === "") { i++; continue; }
      out += `<p>${inline(l)}</p>`; i++;
    }
    return out;
  }

  // Lucide icons, the set the app uses (lucide-react, same names).
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICON = {
    chev: svg('<path d="m9 18 6-6-6-6"/>'),
    search: svg('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'),
    panel: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'),
    pen: svg('<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>'),
    folderPlus: svg('<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
    fold: svg('<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>'),
    type: svg('<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>'),
    code: svg('<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>'),
    split: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>'),
    dots: svg('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'),
    coin: svg('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>'),
    file: svg('<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'),
    folder: svg('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
    folderOpen: svg('<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'),
    folderRoot: svg('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><circle cx="12" cy="13" r="2"/><path d="M12 15v5"/>'),
  };
  const PLACE = "my-project";

  const root = document.getElementById("demo");
  if (!root) return;
  root.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = ICON[el.dataset.icon]));
  const tree = root.querySelector(".d-tree"), doc = root.querySelector(".d-doc"), crumb = root.querySelector(".d-crumb");
  const edits = {}; let current = null;
  const q = (s) => root.querySelector(s);
  q(".d-coin").innerHTML = ICON.coin;
  const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));
  let saveTimer;
  function stats(saving) {
    const text = doc.innerText.trim();
    const tokens = Math.ceil(text.length / 4), words = text ? text.split(/\s+/).length : 0;
    q(".d-tokens").textContent = `≈ ${fmt(tokens)} tokens`;
    q(".d-words").textContent = `${fmt(words)} words`;
    q(".d-meter i").style.width = Math.min(100, tokens / 50) + "%";
    if (saving) {
      q(".d-saved").textContent = "Saving…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => (q(".d-saved").textContent = "Saved"), 700);
    }
  }
  doc.addEventListener("input", () => stats(true));

  function open(path) {
    if (current) edits[current] = doc.innerHTML;
    current = path;
    doc.innerHTML = edits[path] || render(FILES[path]);
    doc.parentElement.scrollTop = 0;
    const parts = [PLACE, ...path.split("/")], name = parts.pop();
    crumb.innerHTML = parts.map((p) => `<span>${esc(p)}</span><span>/</span>`).join("") + `<b>${esc(name)}</b>`;
    q(".d-saved").textContent = ""; stats(false);
    tree.querySelectorAll("[data-path]").forEach((b) => {
      const on = b.dataset.path === path;
      b.dataset.active = String(on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }

  const fold = q(".d-fold");
  const folders = [];
  function setOpen(row, kids, open) {
    row.setAttribute("aria-expanded", String(open));
    kids.hidden = !open;
    if (row.classList.contains("place")) return;
    row.querySelector(":scope > svg").outerHTML = open ? ICON.folderOpen : ICON.folder;
    fold.disabled = !folders.some(([r]) => r.getAttribute("aria-expanded") === "true");
  }
  function folderRow(label, icon, depth, cls) {
    const b = document.createElement("button"), kids = document.createElement("div");
    b.type = "button"; b.className = `d-row dir ${cls}`; b.style.setProperty("--depth", depth);
    b.innerHTML = `<span class="chev">${ICON.chev}</span>${icon}<span class="name">${esc(label)}</span>`;
    kids.className = "d-kids"; kids.style.setProperty("--depth", depth + 1);
    b.onclick = () => setOpen(b, kids, b.getAttribute("aria-expanded") !== "true");
    return [b, kids];
  }
  function build(items, parent, depth) {
    items.forEach((it) => {
      if (typeof it === "string") {
        const b = document.createElement("button");
        b.type = "button"; b.className = "d-row"; b.dataset.path = it; b.style.setProperty("--depth", depth);
        b.innerHTML = ICON.file + `<span class="name">${esc(it.split("/").pop())}</span><span class="d-dots">${ICON.dots}</span>`;
        b.onclick = () => open(it);
        parent.append(b);
      } else {
        const [b, kids] = folderRow(it[0], ICON.folder, depth, "");
        folders.push([b, kids]);
        parent.append(b, kids); build(it[1], kids, depth + 1);
      }
    });
  }
  const group = document.createElement("div"); group.className = "d-group";
  const [placeRow, placeKids] = folderRow(PLACE, ICON.folderRoot, 0, "place");
  group.append(placeRow, placeKids); tree.append(group);
  build(TREE, placeKids, 1);
  setOpen(placeRow, placeKids, true);
  folders.forEach(([b, kids]) => setOpen(b, kids, true));
  fold.onclick = () => folders.forEach(([b, kids]) => setOpen(b, kids, false));

  doc.addEventListener("change", (e) => {
    if (e.target.matches("input[type=checkbox]")) { stats(true); } if (e.target.matches("input[type=checkbox]")) e.target.closest("li").classList.toggle("done", e.target.checked);
  });
  open("plans/refactor-sidebar.md");
})();
