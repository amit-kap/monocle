import { describe, expect, it } from "vitest";
import {
  CHARS_PER_TOKEN,
  countWords,
  estimateTokens,
  formatTokens,
  formatTokensShort,
  tokensFromBytes,
} from "./tokens";

describe("token estimate", () => {
  it("is characters divided by 3.5, rounded", () => {
    expect(CHARS_PER_TOKEN).toBe(3.5);
    expect(estimateTokens("x".repeat(350))).toBe(100);
    expect(estimateTokens("x".repeat(10))).toBe(3);
    expect(estimateTokens("")).toBe(0);
    expect(tokensFromBytes(700)).toBe(200);
  });

  it("counts words", () => {
    expect(countWords("one two\nthree  four")).toBe(4);
    expect(countWords("")).toBe(0);
  });

  it("formats full numbers with separators and thousands as 1.8k", () => {
    expect(formatTokens(1840)).toBe("1,840");
    expect(formatTokensShort(1840)).toBe("1.8k");
    expect(formatTokensShort(2000)).toBe("2k");
    expect(formatTokensShort(640)).toBe("640");
  });
});
