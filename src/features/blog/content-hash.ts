/**
 * A short fingerprint of a post's markdown (FNV-1a, 32-bit), to tell whether
 * the body the browser fetched is the one rendered at build.
 *
 * The body, not `updated_at`: the timestamp moved on every view until the
 * trigger was fixed, and moves for edits that leave the body alone. Not a
 * security boundary; a collision only means rendering the built body.
 */
export function contentHash(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
