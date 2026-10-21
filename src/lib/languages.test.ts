import { describe, expect, it } from "vitest";
import {
  filterLanguages,
  findLanguage,
  languageOptions,
  PLAIN_TEXT,
  tagFor,
} from "./languages";

// A slice of lowlight's common set, enough to pin order and fallbacks down.
const GRAMMARS = ["javascript", "plaintext", "python", "typescript", "xml"];

function options() {
  return languageOptions(GRAMMARS);
}

function pick(label: string) {
  const option = options().find((o) => o.label === label);
  if (!option) throw new Error(`no option labelled ${label}`);
  return option;
}

describe("languageOptions", () => {
  it("puts Plain text first, then the rest by name", () => {
    expect(options().map((o) => o.label)).toEqual([
      "Plain text",
      "HTML",
      "JavaScript",
      "Python",
      "TypeScript",
      "XML",
    ]);
  });

  it("uses a name of our own where the grammar name is not readable", () => {
    const headings = languageOptions(["c", "cpp", "csharp", "objectivec"])
      .map((o) => o.label)
      .filter((label) => label !== "Plain text");
    expect(headings).toEqual(["C", "C#", "C++", "Objective-C"]);
  });

  it("answers to the tag people write", () => {
    expect(pick("TypeScript").tags).toEqual(["typescript", "ts", "tsx"]);
  });

  it("offers aliases that highlight with a grammar the editor has", () => {
    expect(pick("HTML").value).toBe("xml");
  });

  it("leaves aliases out when their grammar is not available", () => {
    expect(languageOptions(["python"]).map((o) => o.label)).toEqual([
      "Plain text",
      "Python",
    ]);
  });

  it("falls back to the grammar name for a language it has no label for", () => {
    expect(languageOptions(["funkyscript"])).toContainEqual({
      value: "funkyscript",
      label: "funkyscript",
      tags: ["funkyscript"],
    });
  });

  it("leaves the caller's array alone", () => {
    const grammars = ["python", "plaintext"];
    languageOptions(grammars);
    expect(grammars).toEqual(["python", "plaintext"]);
  });
});

describe("filterLanguages", () => {
  it("keeps everything for an empty query", () => {
    expect(filterLanguages(options(), "  ").length).toBe(options().length);
  });

  it("matches a label", () => {
    expect(filterLanguages(options(), "type").map((o) => o.label)).toEqual([
      "TypeScript",
    ]);
  });

  it("matches the tag people write instead of the grammar name", () => {
    expect(filterLanguages(options(), "js").map((o) => o.label)).toContain(
      "JavaScript",
    );
    expect(filterLanguages(options(), "htm").map((o) => o.label)).toEqual([
      "HTML",
    ]);
  });

  it("ignores case", () => {
    expect(filterLanguages(options(), "PY").map((o) => o.label)).toEqual([
      "Python",
    ]);
  });
});

describe("findLanguage", () => {
  it.each([
    ["js", "javascript"],
    ["jsx", "javascript"],
    ["ts", "typescript"],
    ["tsx", "typescript"],
    ["py", "python"],
    ["HTM", "xml"],
    ["text", PLAIN_TEXT],
  ])("reads the fence tag %s as %s", (tag, expected) => {
    expect(findLanguage(tag, options())?.value).toBe(expected);
  });

  it("reads a full grammar name", () => {
    expect(findLanguage("typescript", options())?.value).toBe("typescript");
  });

  it("reads a bare fence as Plain text", () => {
    expect(findLanguage("", options())?.value).toBe(PLAIN_TEXT);
    expect(findLanguage(null, options())?.value).toBe(PLAIN_TEXT);
    expect(findLanguage(undefined, options())?.value).toBe(PLAIN_TEXT);
  });

  it("has no option for a tag nobody knows", () => {
    expect(findLanguage("nosuchlang", options())).toBeNull();
  });

  it("shows HTML rather than XML for an html fence", () => {
    expect(findLanguage("html", options())?.label).toBe("HTML");
    expect(findLanguage("xml", options())?.label).toBe("XML");
  });
});

describe("tagFor", () => {
  it("keeps the tag an author already used", () => {
    expect(tagFor("js", pick("JavaScript"))).toBe("js");
    expect(tagFor("HTML", pick("HTML"))).toBe("html");
  });

  it("writes the grammar name for a tag the option does not answer to", () => {
    expect(tagFor("", pick("JavaScript"))).toBe("javascript");
    expect(tagFor("nosuchlang", pick("JavaScript"))).toBe("javascript");
  });

  it("clears the tag for Plain text", () => {
    expect(tagFor("js", pick("Plain text"))).toBe("");
  });
});
