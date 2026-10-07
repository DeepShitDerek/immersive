/**
 * Requests a check must never make against a live project.
 *
 * Builds made with the live settings talk to the live database, so every
 * page a check opened was recorded as a visit, and every post it held open
 * for five seconds as a view, on the owner's real figures, every deploy.
 * Browser checks block these; the app also skips them under automation
 * (navigator.webdriver), which not every driver sets.
 */
export const TRACKING_URL_PATTERNS = [
  "*/rest/v1/site_visits*",
  "*/rest/v1/rpc/increment_blog_post_view*",
];

/** Block them in a DevTools session (`send` is the script's CDP call). */
export async function blockTracking(send) {
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: TRACKING_URL_PATTERNS });
}
