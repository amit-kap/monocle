import { describe, expect, it } from "vitest";
import { linkHref } from "./linkInput";

describe("linkHref", () => {
  it.each([
    ["https://", ""],
    ["", ""],
    ["https://example.com", "https://example.com"],
    ["https://https://example.com", "https://example.com"],
    ["https://http://example.com", "http://example.com"],
    ["https://mailto:a@b.co", "mailto:a@b.co"],
    ["example.com/page", "https://example.com/page"],
    ["./notes/other.md", "./notes/other.md"],
    ["#heading", "#heading"],
  ])("%s → %s", (input, expected) => expect(linkHref(input)).toBe(expected));
});
