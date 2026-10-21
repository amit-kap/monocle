import { common, createLowlight } from "lowlight";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";

// Only the common grammars: a markdown editor highlighting every language
// would add megabytes to the bundle for little practical gain. Token colours
// come from CSS custom properties (see styles.css) so highlighting follows the
// app's light/dark themes instead of shipping two JS themes.
export const lowlight = createLowlight(common);

// Replaces StarterKit's codeBlock. The name stays `codeBlock`, which is what
// tiptap-markdown looks up to find the fence serializer.
//
// A fence's tag stays on the node exactly as the author wrote it, so the file
// round-trips unchanged. Highlighting a tag is lowlight's own business: it
// knows the usual aliases (`js`, `ts`, `sh`), and a tag no grammar matches is
// auto-detected rather than left plain. `lib/languages.ts` holds the names and
// tags the picker offers.
export const CodeBlock = CodeBlockLowlight.extend({
  name: "codeBlock",
}).configure({ lowlight });