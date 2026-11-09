import "server-only";

export const UNTRUSTED_TAGS = ["document", "prior_output", "db_text"] as const;
export type UntrustedTag = (typeof UNTRUSTED_TAGS)[number];
export const TAG_REMOVED = "[tag removed]";
// Characters a reader skips over (soft hyphen, zero-width and bidi controls), allowed anywhere inside a tag.
const INVISIBLE = "\\u00AD\\u034F\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF";
const GAP = `[\\s${INVISIBLE}]*`;
// Homoglyphs of the letters in our tag names (Cyrillic, Greek, Roman numerals); fullwidth forms are added per letter.
const LOOKALIKES: Readonly<Record<string, string>> = { a: "аα", b: "Ьƅ", c: "сϲⅽ", d: "ԁⅾ", e: "е", i: "іι", m: "ⅿ", o: "оοօ", p: "рρ", r: "г", t: "т", u: "υս", x: "хⅹ" };
const letter = (char: string) => `[${char === "_" ? "_＿" : `${char}${String.fromCharCode(char.charCodeAt(0) + 0xfee0)}${LOOKALIKES[char] ?? ""}`}][${INVISIBLE}]*`;
const names = UNTRUSTED_TAGS.map((tag) => [...tag].map(letter).join("")).join("|");
const open = "(?:<|＜|﹤|‹|⟨|〈|〈|&lt;|&#0*60;|&#x0*3c;)";
const close = "(?:>|＞|﹥|›|⟩|〉|〉|&gt;|&#0*62;|&#x0*3e;)";
const prefix = `${open}${GAP}(?:/|／|⁄|∕)?${GAP}(?:${names})(?![A-Za-z0-9_-])`;
const tagPattern = new RegExp(`${prefix}(?:[\\s${INVISIBLE} A-Za-z0-9_"'=:./-]{0,256}${close})?`, "gi");

export function neutralizeTags(text: string): string {
  return text.replace(tagPattern, TAG_REMOVED);
}
export function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function wrapUntrusted(tag: UntrustedTag, attributes: ReadonlyArray<readonly [string, string | number | null | undefined]>, content: string): string {
  const rendered = attributes.map(([name, value]) => {
    if (!/^[a-z][a-z_]*$/.test(name)) throw new Error("invalid attribute name");
    if (value === null || value === undefined || value === "") return "";
    return ` ${name}="${escapeAttribute(String(value))}"`;
  }).join("");
  return `<${tag}${rendered}>\n${neutralizeTags(content)}\n</${tag}>`;
}
