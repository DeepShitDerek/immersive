/**
 * Validation for the credentials `integration_settings` stores.
 *
 * A webhook URL is pasted from another application, and a mistyped one fails
 * silently inside a database trigger where nobody will ever see the error — so
 * it is worth checking the shape before it is saved rather than wondering later
 * why no notification arrived.
 */

/** Hosts Discord actually serves webhooks from. */
const DISCORD_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
]);

/**
 * Is this a Discord webhook URL?
 *
 * Parsed rather than matched with a regular expression, so
 * `https://evil.example/discord.com/api/webhooks/1/2` is rejected on its host
 * instead of passing on a substring. HTTPS is required: the trigger posts the
 * message body, and `pg_net` will happily send it in the clear otherwise.
 */
export function isDiscordWebhook(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (!DISCORD_HOSTS.has(url.hostname.toLowerCase())) return false;

  // /api/webhooks/{id}/{token}, optionally after a version segment.
  return /^\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+$/.test(url.pathname);
}
