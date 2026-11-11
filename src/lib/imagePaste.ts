// Pasting or dropping an image saves it next to the note and inserts a
// relative link. These are the pure parts of that.

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

export function isImageFile(file: { type: string; name?: string }): boolean {
  if (file.type in EXT_BY_MIME) return true;
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(file.name ?? "");
}

export function imageExtension(file: { type: string; name?: string }): string {
  if (file.type in EXT_BY_MIME) return EXT_BY_MIME[file.type];
  const match = /\.([a-z0-9]+)$/i.exec(file.name ?? "");
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "png";
}

/** Alt text from a file name: `Screen Shot 1.png` becomes `Screen Shot 1`. */
export function altFromName(name: string | undefined): string {
  return (name ?? "").replace(/\.[a-z0-9]+$/i, "").replace(/[\[\]]/g, "");
}
