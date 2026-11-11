// The token estimate. There is no offline tokenizer for current Claude models,
// so this is characters over a constant, always shown with "≈".

/** Characters per token. The one place the estimate is tuned. */
export const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text: string): number {
  return Math.round(text.length / CHARS_PER_TOKEN);
}

/** From a file's size in bytes, where we have not read the text. */
export function tokensFromBytes(bytes: number): number {
  return Math.round(bytes / CHARS_PER_TOKEN);
}

export function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

export function formatTokens(count: number): string {
  return count.toLocaleString("en-US");
}

/** Thousands as `1.8k`, for tight spaces. */
export function formatTokensShort(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}
