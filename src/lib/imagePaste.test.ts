import { describe, expect, it } from "vitest";
import { altFromName, imageExtension, isImageFile } from "./imagePaste";

describe("image paste helpers", () => {
  it("recognises image files by type or by name", () => {
    expect(isImageFile({ type: "image/png" })).toBe(true);
    expect(isImageFile({ type: "", name: "shot.JPG" })).toBe(true);
    expect(isImageFile({ type: "text/plain", name: "a.txt" })).toBe(false);
  });

  it("picks the extension from the type first, then the name", () => {
    expect(imageExtension({ type: "image/jpeg" })).toBe("jpg");
    expect(imageExtension({ type: "", name: "pic.jpeg" })).toBe("jpg");
    expect(imageExtension({ type: "image/webp" })).toBe("webp");
    expect(imageExtension({ type: "" })).toBe("png");
  });

  it("makes alt text from the file name", () => {
    expect(altFromName("Screen Shot 1.png")).toBe("Screen Shot 1");
    expect(altFromName(undefined)).toBe("");
  });
});
