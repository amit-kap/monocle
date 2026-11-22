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

  // Lucide icons, the set the app uses.
  const ICON = {
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    updown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  };


  const root = document.getElementById("demo");
  if (root) { root.querySelector(".d-search").innerHTML = ICON.search; root.querySelector(".d-updown").innerHTML = ICON.updown; root.querySelector(".d-folder").innerHTML = ICON.folder; }
  if (!root) return;
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
    const parts = path.split("/"), name = parts.pop();
    crumb.innerHTML = parts.map((p) => `${esc(p)} /`).join(" ") + ` <b>${esc(name)}</b>`;
    q(".d-saved").textContent = ""; stats(false);
    tree.querySelectorAll("[data-path]").forEach((b) => b.setAttribute("aria-current", String(b.dataset.path === path)));
  }

  function build(items, parent) {
    items.forEach((it) => {
      if (typeof it === "string") {
        const b = document.createElement("button");
        b.className = "d-row"; b.dataset.path = it; b.type = "button";
        b.innerHTML = ICON.file + `<span>${esc(it.split("/").pop())}</span>`;
        b.onclick = () => open(it);
        parent.append(b);
      } else {
        const b = document.createElement("button"), kids = document.createElement("div");
        b.className = "d-row"; b.type = "button"; b.setAttribute("aria-expanded", "true");
        b.innerHTML = ICON.chev + ICON.folder + `<span>${esc(it[0])}</span>`;
        kids.className = "d-kids";
        b.onclick = () => { const o = b.getAttribute("aria-expanded") === "true"; b.setAttribute("aria-expanded", String(!o)); kids.hidden = o; };
        parent.append(b, kids); build(it[1], kids);
      }
    });
  }
  build(TREE, tree);

  doc.addEventListener("change", (e) => {
    if (e.target.matches("input[type=checkbox]")) { stats(true); } if (e.target.matches("input[type=checkbox]")) e.target.closest("li").classList.toggle("done", e.target.checked);
  });
  open("plans/refactor-sidebar.md");
})();
