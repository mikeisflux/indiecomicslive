// Conservative HTML allow-list sanitizer for seller-authored
// rich-text fields (currently: Lot.mysteryContentsHtml).
//
// Trust model: only sellers we explicitly approved via
// /admin/seller-applications can post these fields. This function
// trims the obvious foot-guns (script execution, exfiltration via
// embedded resources, javascript: hrefs, on* event handlers) so
// even a compromised seller account can't pivot into stored XSS
// against admins or other buyers.
//
// Regex-based — fine for our trust level. If we ever expose this to
// untrusted UGC, swap for a parser-based sanitizer (sanitize-html /
// isomorphic-dompurify).

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

// Tags whose CONTENTS we strip too — they can ship JS / pull resources
// / submit forms regardless of attribute filtering.
const STRIP_WITH_CONTENT = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "svg",
  "math",
  "link",
  "meta",
  "noscript",
];

export function sanitizeMysteryHtml(input: string | null | undefined): string {
  if (!input) return "";

  let s = input;

  // 1. Strip the dangerous tags + their inner text.
  for (const tag of STRIP_WITH_CONTENT) {
    s = s.replace(
      new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, "gi"),
      "",
    );
    s = s.replace(new RegExp(`<\\s*${tag}\\b[^>]*\\/?\\s*>`, "gi"), "");
  }

  // 2. Strip any on* event-handler attribute.
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 3. Defang dangerous protocols on href / src / xlink:href / formaction.
  s = s.replace(
    /\b(href|src|xlink:href|formaction)\s*=\s*("|')\s*(javascript|data|vbscript)\s*:/gi,
    '$1=$2#blocked-',
  );

  // 4. Strip any <tag …> whose tag name isn't in the allow-list.
  s = s.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag: string) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : "";
  });

  return s;
}
