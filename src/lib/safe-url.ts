/**
 * URL guards for CMS-authored values.
 *
 * Every href/src on the public site comes out of Postgres, where the columns
 * are unconstrained TEXT. The seed proves the point: `link_url` holds
 * `javascript:alert(document.domain)` and `image_url` holds a
 * `data:text/html;base64,...` payload. Neither is dangerous in the database —
 * both are dangerous the moment they reach an attribute.
 *
 * Rule: allowlist schemes, never blocklist. Blocklists lose to `JaVaScRiPt:`,
 * tab-separated `java\tscript:`, and zero-width-padded variants.
 */

const SAFE_LINK_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);
const SAFE_IMAGE_SCHEMES = new Set(["http:", "https:"]);

/**
 * Characters browsers ignore while parsing a scheme: C0 controls, space, and
 * the zero-width / bidi family the seed stores in its unicode probes.
 * Built with escapes rather than literals so the source file stays printable.
 */
const IGNORABLE = new RegExp(
  "[\\u0000-\\u0020\\u00a0\\u1680\\u180e\\u2000-\\u200f\\u2028\\u2029\\u202a-\\u202e\\u205f\\u2060-\\u2064\\u3000\\ufeff]",
  "g",
);

function normalise(raw: string): string {
  return raw.replace(IGNORABLE, "").toLowerCase();
}

function hasScheme(raw: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(normalise(raw));
}

/**
 * A CMS link is safe when it is a relative path, a fragment, or an absolute
 * URL on an allowlisted scheme. Returns null when it is not — callers render
 * plain text instead of a link.
 */
export function safeLinkUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  // Protocol-relative ("//attacker.example") inherits the page scheme and is a
  // classic open-redirect vector. Require an explicit scheme instead.
  if (value.startsWith("//")) return null;

  // Relative path or in-page anchor.
  if (value.startsWith("/") || value.startsWith("#")) return value;

  if (!hasScheme(value)) return null;

  try {
    // Parsing the *normalised* string closes the "java\tscript:" gap; the
    // original is returned so legitimate URLs keep their casing and encoding.
    const url = new URL(normalise(value));
    return SAFE_LINK_SCHEMES.has(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

/** Images additionally reject data: and blob: — an SVG data URI can script. */
export function safeImageUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/")) return value;
  if (!hasScheme(value)) return null;

  try {
    const url = new URL(normalise(value));
    return SAFE_IMAGE_SCHEMES.has(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

/** True for same-origin links, which should route client-side, not open a tab. */
export function isInternalUrl(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#");
}

/**
 * Passed to react-markdown's `urlTransform` so link and image URLs inside
 * markdown bodies go through the same allowlist as structured fields.
 * `[click](javascript:alert(1))` becomes an inert anchor.
 */
export function markdownUrlTransform(url: string): string {
  return safeLinkUrl(url) ?? "";
}
