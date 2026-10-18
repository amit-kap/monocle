// Language data for the code-block picker. Values are the grammar names
// lowlight ships (highlight.js' "common" set), because those are what highlight
// and what a fence's info string should keep: a block tagged `js` still saves
// as `js`, while the menu shows JavaScript and checks it.

export type LanguageOption = {
  /** Written into the fence's info string. */
  value: string;
  /** Shown in the menu. */
  label: string;
  /** Tags that mean this option, for search and for reading a fence. */
  tags: string[];
};

/** The grammar behind a fence with no tag. Picking it clears the tag again. */
export const PLAIN_TEXT = "plaintext";

// One entry per grammar lowlight knows, plus the tags worth showing in the
// menu. `codeHighlight.test.ts` checks this table against lowlight's list, so a
// grammar added to the editor is a grammar that gets a name here.
export const LANGUAGES: Record<string, { label: string; tags?: string[] }> = {
  arduino: { label: "Arduino" },
  bash: { label: "Bash", tags: ["sh", "zsh"] },
  c: { label: "C" },
  cpp: { label: "C++", tags: ["cxx"] },
  csharp: { label: "C#", tags: ["cs"] },
  css: { label: "CSS" },
  diff: { label: "Diff", tags: ["patch"] },
  go: { label: "Go", tags: ["golang"] },
  graphql: { label: "GraphQL" },
  ini: { label: "INI", tags: ["toml", "conf"] },
  java: { label: "Java" },
  javascript: {
    label: "JavaScript",
    tags: ["js", "jsx", "mjs", "cjs", "node"],
  },
  json: { label: "JSON" },
  kotlin: { label: "Kotlin" },
  less: { label: "LESS" },
  lua: { label: "Lua" },
  makefile: { label: "Makefile", tags: ["make"] },
  markdown: { label: "Markdown", tags: ["md"] },
  objectivec: { label: "Objective-C", tags: ["objc", "mm"] },
  perl: { label: "Perl", tags: ["pl"] },
  php: { label: "PHP" },
  "php-template": { label: "PHP template" },
  [PLAIN_TEXT]: { label: "Plain text", tags: ["text", "txt", "none"] },
  python: { label: "Python", tags: ["py"] },
  "python-repl": { label: "Python REPL", tags: ["pycon"] },
  r: { label: "R" },
  ruby: { label: "Ruby", tags: ["rb"] },
  rust: { label: "Rust", tags: ["rs"] },
  scss: { label: "SCSS", tags: ["sass"] },
  shell: { label: "Shell session", tags: ["console", "shellsession"] },
  sql: { label: "SQL" },
  swift: { label: "Swift" },
  typescript: { label: "TypeScript", tags: ["ts", "tsx"] },
  vbnet: { label: "VB.NET", tags: ["vb"] },
  wasm: { label: "WebAssembly", tags: ["wasm"] },
  xml: { label: "XML", tags: ["svg"] },
  yaml: { label: "YAML", tags: ["yml"] },
};

// Not grammars of their own: they highlight with the grammar they name, which
// is how highlight.js reads them too. Their tags are all they answer to, so a
// fence tagged `xml` reads as XML rather than HTML.
const ALIAS_OPTIONS: LanguageOption[] = [
  { value: "xml", label: "HTML", tags: ["html", "htm"] },
];

function option(value: string): LanguageOption {
  const entry = LANGUAGES[value];
  return {
    value,
    label: entry?.label ?? value,
    tags: [value, ...(entry?.tags ?? [])],
  };
}

// Case-insensitive, and stable for the pairs that differ only in punctuation
// ("C#", "C++", "CSS").
function byLabel(a: LanguageOption, b: LanguageOption): number {
  const left = a.label.toLowerCase();
  const right = b.label.toLowerCase();
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * The menu's options: one per grammar the editor can highlight, alphabetical by
 * name, with Plain text first (it is what an untagged fence means).
 */
export function languageOptions(grammars: string[]): LanguageOption[] {
  // An alias is only worth offering while the grammar behind it is available.
  const aliases = ALIAS_OPTIONS.filter((o) => grammars.includes(o.value));
  // Plain text is always on offer: clearing a fence needs no grammar.
  const named = grammars.filter((name) => name !== PLAIN_TEXT);
  const options = [option(PLAIN_TEXT), ...named.map(option), ...aliases].sort(
    byLabel,
  );
  const plain = options.findIndex((o) => o.value === PLAIN_TEXT);
  if (plain > 0) options.unshift(...options.splice(plain, 1));
  return options;
}

/** Options matching a query, by name, label, or a tag people write for them. */
export function filterLanguages(
  options: LanguageOption[],
  query: string,
): LanguageOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) =>
    [option.value, option.label.toLowerCase(), ...option.tags].some((term) =>
      term.includes(needle),
    ),
  );
}

/** The option a fence tag means, or null when nobody knows that tag. */
export function findLanguage(
  tag: string | null | undefined,
  options: LanguageOption[],
): LanguageOption | null {
  const cleaned = (tag ?? "").trim().toLowerCase();
  if (!cleaned) return options.find((o) => o.value === PLAIN_TEXT) ?? null;
  return options.find((o) => o.tags.includes(cleaned)) ?? null;
}

/**
 * The tag to write when an option is picked for a block tagged `tag`: a tag the
 * option already answers to is kept as the author wrote it, so picking
 * JavaScript for a ```js block leaves the fence alone. Plain text clears it.
 */
export function tagFor(
  tag: string | null | undefined,
  option: LanguageOption,
): string {
  if (option.value === PLAIN_TEXT) return "";
  const cleaned = (tag ?? "").trim().toLowerCase();
  return option.tags.includes(cleaned) ? cleaned : option.value;
}
