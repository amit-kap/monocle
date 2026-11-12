import { blankFrontmatter } from "./frontmatter";
import { estimateTokens } from "./tokens";

export type Heading = {
  level: number;
  title: string;
  /** Zero-based line in the text where the heading is. */
  line: number;
  /** Which heading this is, counting from the top. */
  index: number;
  /** Tokens in the section: this heading to the next heading of any level. */
  tokens: number;
};

/** Lines with fenced code blocks blanked out, so `# comment` is not a heading. */
function outsideFences(lines: string[]): boolean[] {
  const inside: boolean[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence === null && open) {
      fence = open[1][0];
      inside.push(true);
    } else if (fence !== null) {
      inside.push(true);
      const close = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (close && close[1][0] === fence) fence = null;
    } else {
      inside.push(false);
    }
  }
  return inside;
}

export function parseHeadings(text: string): Heading[] {
  const lines = blankFrontmatter(text).split("\n");
  const fenced = outsideFences(lines);
  const found: Omit<Heading, "tokens" | "index">[] = [];
  lines.forEach((line, i) => {
    if (fenced[i]) return;
    const match = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
    if (match) found.push({ level: match[1].length, title: match[2], line: i });
  });
  return found.map((heading, index) => {
    const end = found[index + 1]?.line ?? lines.length;
    const section = lines.slice(heading.line, end).join("\n");
    return { ...heading, index, tokens: estimateTokens(section) };
  });
}

/** The heading a line sits under, or null above the first heading. */
export function headingAtLine(headings: Heading[], line: number): Heading | null {
  let hit: Heading | null = null;
  for (const heading of headings) {
    if (heading.line <= line) hit = heading;
    else break;
  }
  return hit;
}

/**
 * The section a heading opens: from it to the next heading of the same or a
 * higher level.
 */
export function sectionText(text: string, headings: Heading[], index: number): string {
  const heading = headings[index];
  if (!heading) return text;
  const lines = text.split("\n");
  const stop = headings.find(
    (other) => other.index > index && other.level <= heading.level,
  );
  return lines.slice(heading.line, stop?.line ?? lines.length).join("\n").replace(/\n+$/, "");
}

export type Reference = {
  kind: "link" | "image";
  target: string;
  alt: string;
  line: number;
  /** The heading it sits under, or null above the first heading. */
  section: string | null;
};

/** Markdown links and images in the text, outside code. */
export function extractReferences(text: string): Reference[] {
  const lines = blankFrontmatter(text).split("\n");
  const fenced = outsideFences(lines);
  const headings = parseHeadings(text);
  const refs: Reference[] = [];
  lines.forEach((line, i) => {
    if (fenced[i]) return;
    const scrubbed = line.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));
    const pattern = /(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(scrubbed))) {
      refs.push({
        kind: match[1] ? "image" : "link",
        alt: match[2],
        target: match[3],
        line: i,
        section: headingAtLine(headings, i)?.title ?? null,
      });
    }
  });
  return refs;
}

/** A target that points at another file on disk (not a URL, anchor or mail link). */
export function isRelativeFile(target: string): boolean {
  return !/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target);
}

export function stripAnchor(target: string): string {
  return decodeURI(target.split("#")[0].split("?")[0]);
}
