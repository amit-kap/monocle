import { describe, expect, it } from "vitest";
import {
  isAbsolutePath,
  isRemoteSrc,
  joinPath,
  noteDir,
  resolveImagePath,
} from "./imagePath";

describe("isRemoteSrc", () => {
  it.each([
    "https://example.com/a.png",
    "http://example.com/a.png",
    "data:image/png;base64,AAAA",
    "asset://localhost/Users/me/a.png",
    "blob:abc",
  ])("treats %s as already addressable", (src) => {
    expect(isRemoteSrc(src)).toBe(true);
  });

  it.each(["a.png", "assets/a.png", "/Users/me/a.png", "./a.png"])(
    "treats %s as a local path",
    (src) => {
      expect(isRemoteSrc(src)).toBe(false);
    },
  );
});

describe("joinPath", () => {
  it("joins a relative path onto a directory", () => {
    expect(joinPath("/Users/me/notes", "img.png")).toBe("/Users/me/notes/img.png");
  });

  it("honours nested segments", () => {
    expect(joinPath("/Users/me/notes", "assets/img.png")).toBe(
      "/Users/me/notes/assets/img.png",
    );
  });

  it("resolves .", () => {
    expect(joinPath("/Users/me/notes", "./img.png")).toBe("/Users/me/notes/img.png");
  });

  it("resolves ..", () => {
    expect(joinPath("/Users/me/notes/deep", "../img.png")).toBe(
      "/Users/me/notes/img.png",
    );
  });

  it("cannot climb above the root", () => {
    expect(joinPath("/notes", "../../../etc/passwd")).toBe("/etc/passwd");
  });

  it("tolerates duplicate slashes", () => {
    expect(joinPath("/Users/me//notes", "/img.png")).toBe("/Users/me/notes/img.png");
  });
});

describe("resolveImagePath", () => {
  it("resolves a relative path against the note's folder", () => {
    expect(resolveImagePath("img.png", "/Users/me/notes")).toBe(
      "/Users/me/notes/img.png",
    );
  });

  it("resolves a nested relative path", () => {
    expect(resolveImagePath("assets/img.png", "/Users/me/notes")).toBe(
      "/Users/me/notes/assets/img.png",
    );
  });

  it("passes an absolute path through", () => {
    expect(resolveImagePath("/tmp/img.png", "/Users/me/notes")).toBe("/tmp/img.png");
  });

  it("decodes a percent-encoded path", () => {
    expect(resolveImagePath("my%20image.png", "/notes")).toBe("/notes/my image.png");
  });

  it("strips angle brackets", () => {
    expect(resolveImagePath("<my image.png>", "/notes")).toBe("/notes/my image.png");
  });

  it("leaves a percent-encoded path alone when it cannot be decoded", () => {
    expect(resolveImagePath("100%.png", "/notes")).toBe("/notes/100%.png");
  });

  it.each(["https://example.com/a.png", "data:image/png;base64,AAAA"])(
    "returns null for the remote source %s",
    (src) => {
      expect(resolveImagePath(src, "/notes")).toBeNull();
    },
  );

  it("returns null for an empty src", () => {
    expect(resolveImagePath("", "/notes")).toBeNull();
    expect(resolveImagePath("   ", "/notes")).toBeNull();
  });

  it("returns null for a relative path with no note open", () => {
    expect(resolveImagePath("img.png", null)).toBeNull();
  });
});

describe("noteDir", () => {
  it("returns the folder containing the note", () => {
    expect(noteDir("/Users/me/notes/sub/todo.md")).toBe("/Users/me/notes/sub");
  });

  it("returns null when there is no note", () => {
    expect(noteDir(null)).toBeNull();
  });

  it("returns null for a bare filename", () => {
    expect(noteDir("todo.md")).toBeNull();
  });
});

describe("isAbsolutePath", () => {
  it("recognises a posix absolute path", () => {
    expect(isAbsolutePath("/Users/me")).toBe(true);
    expect(isAbsolutePath("Users/me")).toBe(false);
  });
});