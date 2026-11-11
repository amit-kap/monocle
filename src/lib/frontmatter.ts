// YAML frontmatter: the `---` block at the very top of an agent file. It is
// shown as a properties block under the title, and kept out of the rich editor.

export type Split = {
  /** The frontmatter exactly as written, delimiters and final newline included. */
  frontmatter: string;
  body: string;
};

export function splitFrontmatter(text: string): Split {
  const match = /^---[ \t]*\r?\n([\s\S]*?\r?\n)?---[ \t]*(\r?\n|$)/.exec(text);
  if (!match) return { frontmatter: "", body: text };
  return {
    frontmatter: match[0],
    body: text.slice(match[0].length),
  };
}

export type Property = {
  key: string;
  value: string;
  /** Index of the key's line in the frontmatter's lines. */
  line: number;
  /** False for values that span lines: shown, but edited in source view. */
  editable: boolean;
};

function frontmatterLines(frontmatter: string): string[] {
  return frontmatter.split(/\r?\n/);
}

/** Top-level `key: value` pairs. Anything more complex is kept but not editable. */
export function parseProperties(frontmatter: string): Property[] {
  if (!frontmatter) return [];
  const lines = frontmatterLines(frontmatter);
  const props: Property[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^---[ \t]*$/.test(line)) break;
    const match = /^([A-Za-z0-9_][\w .-]*?):[ \t]*(.*)$/.exec(line);
    if (!match) continue;
    const next = lines[i + 1] ?? "";
    const continues = /^[ \t]+\S/.test(next) || /^[ \t]*-[ \t]/.test(next);
    props.push({
      key: match[1],
      value: match[2],
      line: i,
      editable: !continues && !/^[|>][+-]?$/.test(match[2]),
    });
  }
  return props;
}

/** `[a, b, c]` as its items, for the tag display. Null when it is not a flow list. */
export function listItems(value: string): string[] | null {
  const match = /^\[(.*)\]$/.exec(value.trim());
  if (!match) return null;
  return match[1]
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Replace one property's value, leaving every other character alone. */
export function setProperty(
  frontmatter: string,
  line: number,
  value: string,
): string {
  const newline = frontmatter.includes("\r\n") ? "\r\n" : "\n";
  const lines = frontmatter.split(/\r?\n/);
  const match = /^([A-Za-z0-9_][\w .-]*?:)[ \t]*/.exec(lines[line] ?? "");
  if (!match) return frontmatter;
  lines[line] = `${match[1]} ${value}`.trimEnd();
  return lines.join(newline);
}

/**
 * The text with its frontmatter blanked out line for line, so the rest keeps
 * its line numbers and a `# comment` in the YAML is not read as a heading.
 */
export function blankFrontmatter(text: string): string {
  const { frontmatter } = splitFrontmatter(text);
  if (!frontmatter) return text;
  const lines = frontmatter.split("\n").length - 1;
  return "\n".repeat(lines) + text.slice(frontmatter.length);
}
