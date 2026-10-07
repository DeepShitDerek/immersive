import type { ContactSubmission } from "@/types";

/**
 * What an inbox message *is* at any moment, derived rather than stored.
 *
 * The columns are three independent booleans (`is_read`, `is_archived`,
 * `replied_at`), which is the right storage shape — but the interface needs one
 * answer per row, and computing it in one place means the badge, the filter and
 * the sort can never disagree about what "needs attention" means.
 */

export type InboxState = "unread" | "open" | "replied" | "archived";

export type InboxFilter = "attention" | "all" | "replied" | "archived";

export function messageState(message: ContactSubmission): InboxState {
  if (message.is_archived) return "archived";
  if (message.replied_at) return "replied";
  if (!message.is_read) return "unread";
  return "open";
}

/**
 * A message that is asking something of you.
 *
 * Read-but-unanswered counts: opening a message is not answering it, and an
 * inbox that empties itself the moment you glance at something is how enquiries
 * get lost. Archiving is the deliberate "I am done with this".
 */
function needsAttention(message: ContactSubmission): boolean {
  const state = messageState(message);
  return state === "unread" || state === "open";
}

export const INBOX_FILTERS: {
  id: InboxFilter;
  label: string;
  empty: string;
}[] = [
  {
    id: "attention",
    label: "Needs reply",
    empty: "Nothing waiting on you.",
  },
  {
    id: "all",
    label: "All",
    empty: "No messages yet.",
  },
  {
    id: "replied",
    label: "Replied",
    empty: "Nothing marked replied yet.",
  },
  {
    id: "archived",
    label: "Archived",
    empty: "Nothing archived.",
  },
];

/** Does this message belong in the named view? */
function matchesFilter(
  message: ContactSubmission,
  filter: InboxFilter,
): boolean {
  switch (filter) {
    case "attention":
      return needsAttention(message);
    case "replied":
      return !message.is_archived && Boolean(message.replied_at);
    case "archived":
      return message.is_archived;
    // "All" deliberately excludes archived. Archiving is retirement, and a
    // view that shows everything ever received is not an inbox.
    case "all":
      return !message.is_archived;
  }
}

/** Case-insensitive search across the fields a person would remember. */
function matchesSearch(message: ContactSubmission, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;
  return [message.name, message.email, message.subject, message.message]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export interface InboxCounts {
  attention: number;
  all: number;
  replied: number;
  archived: number;
  unread: number;
}

export function inboxCounts(messages: ContactSubmission[]): InboxCounts {
  return {
    attention: messages.filter((message) => matchesFilter(message, "attention"))
      .length,
    all: messages.filter((message) => matchesFilter(message, "all")).length,
    replied: messages.filter((message) => matchesFilter(message, "replied"))
      .length,
    archived: messages.filter((message) => matchesFilter(message, "archived"))
      .length,
    unread: messages.filter(
      (message) => !message.is_read && !message.is_archived,
    ).length,
  };
}

export type InboxSort = "newest" | "oldest";

export const INBOX_SORTS: { id: InboxSort; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
];

/**
 * Filter, search, and order for display.
 *
 * **Order is the reader's choice, not the view's.** The attention view used to
 * force oldest-first on the reasoning that age is the only signal an inbox has
 * about neglect — which is a good argument, and still the reason the option
 * exists. It was the wrong thing to *impose*: it is also the default view, so
 * opening the inbox showed the oldest message at the top, which is not how any
 * mail client behaves and reads as a bug rather than as a policy.
 *
 * Newest first everywhere by default; oldest is one click away and is worth
 * reaching for when working through a backlog.
 */
export function visibleMessages(
  messages: ContactSubmission[],
  filter: InboxFilter,
  search: string,
  sort: InboxSort = "newest",
): ContactSubmission[] {
  const matched = messages.filter(
    (message) =>
      matchesFilter(message, filter) && matchesSearch(message, search),
  );

  return matched.sort((a, b) => {
    const left = new Date(a.created_at).getTime();
    const right = new Date(b.created_at).getTime();
    return sort === "oldest" ? left - right : right - left;
  });
}

/**
 * How a mail client writes a timestamp: the time if it arrived today, the
 * weekday within the last week, a short date beyond that.
 *
 * "3 days ago" has to be decoded before it can be compared with the row above
 * it, and a column of relative phrases at different lengths does not scan.
 * An absolute value in a fixed shape does.
 */
export function inboxTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Calendar days apart, not elapsed milliseconds: a message from 11pm
  // yesterday is "yesterday" at 1am, not "today".
  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);

  if (days > 0 && days < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * A `mailto:` that opens a reply with the thread already quoted.
 *
 * The whole point of the module is answering these, and the app has no outbox
 * — handing the message to whatever the owner already replies from beats
 * building a mail client badly. Every interpolated value is percent-encoded;
 * an unescaped subject line would truncate the URL at its first `&`.
 */
export function replyMailto(message: ContactSubmission): string {
  const subject = message.subject.toLowerCase().startsWith("re:")
    ? message.subject
    : `Re: ${message.subject}`;

  const quoted = message.message
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  const body = `\n\n---\nOn ${new Date(message.created_at).toLocaleDateString()}, ${message.name} wrote:\n${quoted}\n`;

  return `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * What the open message should become when the list changes.
 * `undefined` means leave it as it is.
 *
 * A wide screen always has a detail pane, so it is filled with the first
 * message. A narrow screen shows the message as a sheet over the list, so
 * nothing is ever opened for the reader; a message that leaves the view
 * closes the sheet.
 */
export function nextSelection(
  visibleIds: readonly string[],
  selectedId: string | null,
  narrow: boolean,
): string | null | undefined {
  if (visibleIds.length === 0) return selectedId === null ? undefined : null;
  if (selectedId !== null && visibleIds.includes(selectedId)) return undefined;
  if (narrow) return selectedId === null ? undefined : null;
  return visibleIds[0];
}
