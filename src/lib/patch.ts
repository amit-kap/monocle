import { matchedPairs, splitLines } from "./diff";

/**
 * Where each baseline line sits in the original. Identical lines are matched
 * by a line diff. Between two matches, if both sides hold the same number of
 * lines they are paired one to one: they are the same lines in different
 * clothes (`*` for `-`, a different table spacing), and pairing them is what
 * lets an edit to one leave its neighbours alone.
 */
function alignLines(base: string[], o: string[]): Map<number, number> {
  const map = new Map<number, number>();
  const pairs = [[-1, -1], ...matchedPairs(base, o), [base.length, o.length]] as [
    number,
    number,
  ][];
  for (let i = 0; i < pairs.length - 1; i += 1) {
    const [pb, po] = pairs[i];
    const [nb, no] = pairs[i + 1];
    if (pb >= 0) map.set(pb, po);
    const gapBase = nb - pb - 1;
    const gapOrig = no - po - 1;
    if (gapBase > 0 && gapBase === gapOrig) {
      for (let k = 1; k <= gapBase; k += 1) map.set(pb + k, po + k);
    }
  }
  return map;
}

const wordsOf = (lines: string[]): string[] =>
  lines.join("\n").split(/\s+/).filter(Boolean);

const blankCount = (lines: string[]): number =>
  lines.filter((line) => line.trim() === "").length;

/**
 * Apply a change made to a hard-wrapped paragraph without re-wrapping it.
 *
 * The editor joins a wrapped paragraph's lines into one; a one-word edit then
 * looks like the whole paragraph changed. When the original lines hold exactly
 * the words the baseline did, patch at the level of words instead, keeping the
 * original's line breaks and spacing everywhere but the edited word.
 * Returns null when the lines are not a re-wrapping of each other.
 */
function reflow(original: string[], baseline: string[], edited: string[]): string[] | null {
  const ow = wordsOf(original);
  const bw = wordsOf(baseline);
  const nw = wordsOf(edited);
  if (ow.length === 0 || ow.length !== bw.length || ow.some((w, i) => w !== bw[i])) return null;
  // A different number of paragraph breaks means the structure changed, which
  // words alone cannot express.
  if (blankCount(baseline) !== blankCount(edited)) return null;

  const text = original.join("\n");
  const lead = /^\s*/.exec(text)?.[0] ?? "";
  const tokens = [...text.matchAll(/(\S+)(\s*)/g)].map((m) => ({ w: m[1], s: m[2] }));
  const pairs = [...matchedPairs(bw, nw), [bw.length, nw.length] as [number, number]];

  const out: { w: string; s: string }[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of pairs) {
    const removed = tokens.slice(i, pi);
    const added = nw.slice(j, pj);
    const closing = removed.length > 0 ? removed[removed.length - 1].s : null;
    if (added.length === 0 && closing !== null && out.length > 0 && closing.includes("\n")) {
      // A deleted word at the end of a line hands its line break to the word before.
      out[out.length - 1] = { ...out[out.length - 1], s: closing };
    }
    if (added.length > 0 && out.length > 0 && out[out.length - 1].s === "") {
      // Appending after the region's last word: a space to separate them.
      out[out.length - 1] = { ...out[out.length - 1], s: " " };
    }
    added.forEach((word, k) => {
      const last = k === added.length - 1;
      const atEnd = pi >= tokens.length;
      out.push({ w: word, s: last ? (closing ?? (atEnd ? "" : " ")) : " " });
    });
    if (pi < tokens.length) out.push(tokens[pi]);
    i = pi + 1;
    j = pj + 1;
  }
  const joined = lead + out.map((t) => t.w + t.s).join("");
  return joined.split("\n");
}

/**
 * Write an edit back with the least change to the file.
 *
 * The editor re-serialises the whole note, and that can differ from the file in
 * ways the author never touched (list markers, spacing, escaping). So instead of
 * writing the editor's output, take only what the user changed — the difference
 * between `baseline` (the editor's output when the note loaded) and `edited`
 * (its output now) — and apply that to the `original` text. Lines the user did
 * not touch stay byte-for-byte as they were.
 */
export function patchOriginal(
  original: string,
  baseline: string,
  edited: string,
): string {
  if (edited === baseline) return original;

  // Work in LF and put the file's own line endings back at the end.
  const crlf = original.includes("\r\n");
  const source = crlf ? original.replace(/\r\n/g, "\n") : original;

  const o = splitLines(source);
  const base = splitLines(baseline);
  const next = splitLines(edited);

  const inOriginal = alignLines(base, o);
  // Hunks of change between the baseline and the edit, as baseline ranges.
  const pairs = matchedPairs(base, next);

  type Hunk = { a: number; b: number; lines: string[] };
  const hunks: Hunk[] = [];
  let ai = 0;
  let bi = 0;
  for (const [pa, pb] of [...pairs, [base.length, next.length] as [number, number]]) {
    if (pa > ai || pb > bi) hunks.push({ a: ai, b: pa, lines: next.slice(bi, pb) });
    ai = pa + 1;
    bi = pb + 1;
  }

  function lastMappedBefore(a: number): number {
    for (let k = a - 1; k >= 0; k -= 1) {
      const hit = inOriginal.get(k);
      if (hit !== undefined) return hit;
    }
    return -1;
  }
  function firstMappedFrom(b: number): number {
    for (let k = b; k < base.length; k += 1) {
      const hit = inOriginal.get(k);
      if (hit !== undefined) return hit;
    }
    return o.length;
  }

  const out: string[] = [];
  let cursor = 0;
  for (const hunk of hunks) {
    const mappedStart = inOriginal.get(hunk.a);
    const start = Math.max(
      cursor,
      hunk.a < base.length && mappedStart !== undefined
        ? mappedStart
        : lastMappedBefore(hunk.a) + 1,
    );
    let end = start;
    if (hunk.b > hunk.a) {
      const mappedLast = inOriginal.get(hunk.b - 1);
      end = mappedLast !== undefined ? mappedLast + 1 : firstMappedFrom(hunk.b);
    }
    end = Math.max(start, end);
    let replacement = hunk.lines;
    if (hunk.b > hunk.a && hunk.lines.length > 0 && end > start) {
      replacement =
        reflow(o.slice(start, end), base.slice(hunk.a, hunk.b), hunk.lines) ?? hunk.lines;
    }
    out.push(...o.slice(cursor, start), ...replacement);
    cursor = end;
  }
  out.push(...o.slice(cursor));

  if (out.length === 0) return "";
  const text = out.join("\n");
  // The file keeps its own ending: a trailing newline stays if it had one, and
  // is not added if it had none. A file that was empty takes the editor's.
  const endsWithNewline = source === "" ? edited.endsWith("\n") : source.endsWith("\n");
  const joined = endsWithNewline ? `${text}\n` : text;
  return crlf ? joined.replace(/\n/g, "\r\n") : joined;
}
