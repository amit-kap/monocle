import { common, createLowlight } from "lowlight";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";

// Only the common grammars: a markdown editor highlighting every language
// would add megabytes to the bundle for little practical gain. Token colours
// come from CSS custom properties (see styles.css) so highlighting follows the
// app's light/dark themes instead of shipping two JS themes.
export const lowlight = createLowlight(common);

// Maps the language written in a fence to the name highlight.js knows. A fence
// can be tagged with anything (`ts`, `sh`, `typescript`), and an unknown tag
// makes lowlight throw, which would break rendering of the whole block.
const ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  yml: "yaml",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  golang: "go",
  ps1: "powershell",
  htm: "html",
  xml: "html",
  text: "plaintext",
  txt: "plaintext",
};

export function resolveLanguage(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const key = tag.trim().toLowerCase();
  if (!key) return null;

  const name = ALIASES[key] ?? key;
  const grammar = (lowlight as unknown as { listLanguages: () => string[] }).listLanguages();
  if (!grammar.includes(name)) return null;

  // Keep the author's tag on the node so the fence round-trips unchanged, but
  // only highlight when we recognise it.
  return name;
}

// Replaces StarterKit's codeBlock. The name stays `codeBlock`, which is what
// tiptap-markdown looks up to find the fence serializer.
export const CodeBlock = CodeBlockLowlight.extend({
  name: "codeBlock",
}).configure({ lowlight });

export { ALIASES };