import { safeLinkUrl } from "@/lib/safe-url";

/**
 * What was typed into the link field, as an address the editor will store.
 *
 * `example.com` is what people type, so a bare domain gets `https://`. The
 * result then goes through the same scheme allowlist as every authored link,
 * so `javascript:` never reaches the document — the body is rendered publicly
 * on the blog and CMS pages.
 */
export function linkFromInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  const local = value.startsWith("/") || value.startsWith("#");
  return safeLinkUrl(hasScheme || local ? value : `https://${value}`);
}
