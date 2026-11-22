/** What the link field opens with when the selection has no link yet. */
export const LINK_PREFIX = "https://";

/**
 * The href for what was typed in the link field, or "" to remove the link.
 * The field opens pre-filled with `https://`, so a pasted full address
 * (`https://https://x.com`, `https://mailto:a@b.c`) drops the prefix, the
 * prefix alone means nothing was typed, and a bare domain gains the scheme.
 */
export function linkHref(value: string): string {
  let typed = value.trim();
  if (typed.toLowerCase().startsWith(LINK_PREFIX)) {
    const rest = typed.slice(LINK_PREFIX.length);
    if (rest === "") return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(rest)) typed = rest;
  }
  if (!typed) return "";
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(typed) || /^[/#.]/.test(typed);
  return !hasScheme && /^[^\s/]+\.[^\s/]+/.test(typed) ? `${LINK_PREFIX}${typed}` : typed;
}
