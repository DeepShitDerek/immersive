/**
 * Ask an image host for a copy near the size it will be shown at.
 *
 * The site is a static export with `images.unoptimized`, so nothing resizes
 * remote images for us. Two hosts will do it themselves, and the default
 * profile picture lives on one of them: GitHub serves a 460px avatar to fill
 * a 40px circle unless asked for less. Any other URL comes back unchanged.
 *
 * `px` is the largest CSS size it renders at; the request doubles it for
 * high-density screens.
 */
export function sizedImageUrl(url: string, px: number): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const size = String(Math.ceil(px * 2));
  if (
    parsed.hostname === "github.com" &&
    /^\/[^/]+\.png$/.test(parsed.pathname)
  ) {
    parsed.searchParams.set("size", size);
    return parsed.toString();
  }
  if (parsed.hostname === "avatars.githubusercontent.com") {
    parsed.searchParams.set("s", size);
    return parsed.toString();
  }
  return url;
}
