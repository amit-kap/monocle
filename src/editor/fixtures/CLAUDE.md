---
description: Conventions every agent follows in this repo
applies to: [Claude Code, Codex, Cursor]
---

# Mod Studio agent guide

Use **pnpm** for everything.  Run the dev server before touching UI code,
and never commit generated files from `dist/`.

## Build and run

```bash
# install and start
pnpm install
pnpm dev --port 5173
```

* Keep changes small
* Prefer editing over creating
    * Nested item with four spaces
    * Another nested item
* Ask when unsure

## Testing rules

1) Run `pnpm test` before every commit.
2) Add a test for each bug you fix.
3) Never skip a failing test; fix it or ask. See [setup](docs/setup.md).

| Command | Purpose |
|---|---|
| `pnpm test` | run unit tests |
| `pnpm lint`   | lint the code |

<details>
<summary>Release notes</summary>

Kept as raw HTML.

</details>

___

## Commit style

Write short imperative subjects. Keep one change per commit, and say why
in the body when the reason is not obvious.
