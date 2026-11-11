import { matchedPairs, splitLines } from "./diff";

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

  const o = splitLines(original);
  const base = splitLines(baseline);
  const next = splitLines(edited);

  // Where each baseline line sits in the original, for lines that match.
  const inOriginal = new Map<number, number>(matchedPairs(base, o));
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

  // For a baseline index, the original line index at or after it.
  function originalStart(a: number): number {
    for (let k = a - 1; k >= 0; k -= 1) {
      const hit = inOriginal.get(k);
      if (hit !== undefined) return hit + 1;
    }
    return 0;
  }
  function originalEnd(b: number): number {
    for (let k = b; k < base.length; k += 1) {
      const hit = inOriginal.get(k);
      if (hit !== undefined) return hit;
    }
    return o.length;
  }

  const out: string[] = [];
  let cursor = 0;
  for (const hunk of hunks) {
    const start = originalStart(hunk.a);
    const end = Math.max(start, originalEnd(hunk.b));
    out.push(...o.slice(cursor, start), ...hunk.lines);
    cursor = end;
  }
  out.push(...o.slice(cursor));

  const text = out.join("\n");
  if (out.length === 0) return "";
  // Keep the original's ending: a trailing newline stays if the file had one.
  return original.endsWith("\n") || edited.endsWith("\n") ? `${text}\n` : text;
}
