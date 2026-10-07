/**
 * What to tell a visitor whose message didn't go through.
 *
 * The raw error is written for developers: a Postgres code, a constraint
 * name, "TypeError: Failed to fetch". A visitor needs two things instead —
 * what happened in plain words, and whether trying again will help. Every
 * message can say "your message is still here" because the form keeps its
 * values on failure.
 */

export type ContactErrorKind =
  | "rate-address" // 3 per address per hour (limit_contact_submissions)
  | "rate-site" // 10 site-wide per minute
  | "offline" // the request never reached the server
  | "refused" // the database rejected the content
  | "unconfigured" // static mode with no webhook
  | "unknown";

export interface ContactErrorView {
  kind: ContactErrorKind;
  message: string;
}

const MESSAGES: Record<ContactErrorKind, string> = {
  "rate-address":
    "You've sent three messages from this address in the last hour, which is the limit. Please try again later.",
  "rate-site":
    "The form is getting a lot of messages right now. Please try again in a minute.",
  offline:
    "Couldn't reach the server. Check your connection and try again. Your message is still here.",
  refused:
    "The message was refused. Check each field and try again. Your message is still here.",
  unconfigured:
    "This site has no message delivery set up, so the form can't send. Please use a direct line instead.",
  unknown:
    "Something went wrong sending that. Please try again. Your message is still here.",
};

function field(error: unknown, key: "message" | "code"): string {
  if (error && typeof error === "object" && key in error) {
    const value = (error as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  }
  return "";
}

export function classifyContactError(error: unknown): ContactErrorKind {
  const message =
    error instanceof Error ? error.message : field(error, "message");
  const code = field(error, "code");

  // The trigger's own wording (db/schema.sql, limit_contact_submissions).
  if (/too many messages from this address/i.test(message))
    return "rate-address";
  if (/contact form is busy/i.test(message)) return "rate-site";
  if (/no message delivery configured/i.test(message)) return "unconfigured";
  // fetch() failures: Chrome, Firefox and Safari word them differently, and
  // supabase-js wraps them as "TypeError: Failed to fetch".
  if (
    /failed to fetch|networkerror|load failed|network request failed/i.test(
      message,
    )
  )
    return "offline";
  // check_violation, string too long, not-null: the content, not the network.
  if (code === "23514" || code === "22001" || code === "23502")
    return "refused";
  return "unknown";
}

export function describeContactError(error: unknown): ContactErrorView {
  const kind = classifyContactError(error);
  return { kind, message: MESSAGES[kind] };
}
