/**
 * The path the site is served under, when it is not the root of its host: a
 * GitHub Pages project site lives at /<repo>/. The deploy workflow passes it
 * as BASE_PATH (from actions/configure-pages); it is empty for a custom
 * domain, a user site, and every local run.
 *
 * A build made for /<repo>/ writes that prefix into every asset URL, so a
 * check that serves or reads out/ has to take it back off to find the file.
 */
const BASE_PATH = (process.env.BASE_PATH ?? "").replace(/\/+$/, "");

/** `/repo/_next/x.js` -> `/_next/x.js`; anything else unchanged. */
export function stripBasePath(pathname) {
  if (!BASE_PATH) return pathname;
  if (pathname === BASE_PATH) return "/";
  return pathname.startsWith(`${BASE_PATH}/`)
    ? pathname.slice(BASE_PATH.length)
    : pathname;
}
