"use client";

import {
  Archive,
  ArchiveRestore,
  CornerUpLeft,
  Mail,
  MailOpen,
} from "lucide-react";
import type { ContactSubmission } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { contactTopicLabel } from "@/lib/contact-topics";
import { inboxTimestamp, messageState, type InboxState } from "./inbox-filters";

/**
 * Icons, not colour alone, carry the state: a filled envelope, an open one,
 * an arrow and a box. The colours are the status tokens.
 */
const STATE_META: Record<
  InboxState,
  { icon: typeof Mail; label: string; className: string }
> = {
  unread: { icon: Mail, label: "Unread", className: "text-primary" },
  open: {
    icon: MailOpen,
    label: "Read, not replied",
    className: "text-warning",
  },
  replied: { icon: CornerUpLeft, label: "Replied", className: "text-success" },
  archived: {
    icon: Archive,
    label: "Archived",
    className: "text-muted-foreground",
  },
};

export interface RowActions {
  onToggleRead: (message: ContactSubmission) => void;
  onToggleArchive: (message: ContactSubmission) => void;
}

/**
 * A message list, not a stack of cards: one surface, flush rows divided by a
 * hairline, the shape every mail client converges on.
 *
 * Each row has a checkbox for cleaning up several at once. It
 * shows on hover and focus, and on every row once anything is checked, so
 * the list does not read as a form; on a touch screen it is always there.
 * Archive and mark read/unread sit at the row's right edge on hover.
 */
export function MessageList({
  messages,
  selectedId,
  onSelect,
  emptyMessage,
  checked,
  onCheck,
  ...actions
}: {
  messages: ContactSubmission[];
  selectedId: string | null;
  onSelect: (message: ContactSubmission) => void;
  emptyMessage: string;
  checked: ReadonlySet<string>;
  onCheck: (id: string, on: boolean) => void;
} & RowActions) {
  if (messages.length === 0) {
    return (
      <div className="rounded-surface border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const selecting = checked.size > 0;
  return (
    <ul className="list-none divide-y divide-border overflow-hidden rounded-surface border bg-card p-0">
      {messages.map((message) => (
        <MessageRow
          key={message.id}
          message={message}
          selected={message.id === selectedId}
          checked={checked.has(message.id)}
          selecting={selecting}
          onSelect={() => onSelect(message)}
          onCheck={(on) => onCheck(message.id, on)}
          {...actions}
        />
      ))}
    </ul>
  );
}

function MessageRow({
  message,
  selected,
  checked,
  selecting,
  onSelect,
  onCheck,
  onToggleRead,
  onToggleArchive,
}: {
  message: ContactSubmission;
  selected: boolean;
  checked: boolean;
  selecting: boolean;
  onSelect: () => void;
  onCheck: (on: boolean) => void;
} & RowActions) {
  const state = messageState(message);
  const meta = STATE_META[state];
  const Icon = meta.icon;
  const unread = state === "unread";
  const topic = contactTopicLabel(message.topic);
  const who = message.name || message.email;

  return (
    <li
      className={cn(
        "group relative flex items-start transition-colors",
        selected
          ? "bg-primary/10"
          : checked
            ? "bg-secondary/60"
            : "hover:bg-secondary/40",
      )}
    >
      {/*
        Unread carries a rail as well as weight: bold alone is a weak signal
        once a few rows are bold.
      */}
      {unread && (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary"
        />
      )}

      <div
        className={cn(
          "flex shrink-0 items-center self-stretch pl-3",
          !selecting &&
            "[@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100",
        )}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheck(value === true)}
          aria-label={`Select the message from ${who}`}
        />
      </div>

      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="min-w-0 flex-1 py-3 pl-3 pr-3.5 text-left focus-ring"
      >
        <div className="flex items-start gap-3">
          <Icon
            className={cn("mt-0.5 size-4 shrink-0", meta.className)}
            aria-hidden
          />
          {/* min-w-0 so the truncation on the children can engage. */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p
                className={cn(
                  "min-w-0 truncate text-sm text-foreground",
                  unread && "font-semibold",
                )}
              >
                {who}
              </p>
              {/* An absolute stamp in a fixed shape, the way mail clients
                  write it: it scans down a column. */}
              <time
                dateTime={message.created_at}
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  unread
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {inboxTimestamp(message.created_at)}
              </time>
            </div>

            <p
              className={cn(
                "mt-0.5 truncate text-sm",
                unread ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {topic && (
                <span className="mr-1.5 rounded-full bg-secondary px-1.5 py-px text-micro font-medium text-secondary-foreground">
                  {topic}
                </span>
              )}
              {message.subject}
            </p>

            {/* break-words: clamping does not constrain one long token. */}
            <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
              {message.message}
            </p>
          </div>
        </div>
        <span className="sr-only">{meta.label}</span>
      </button>

      {/* Hover actions, on a fine pointer only: the detail has them all. */}
      <div className="absolute right-2 top-2 hidden gap-0.5 rounded-control border bg-card p-0.5 [@media(pointer:fine)]:group-focus-within:flex [@media(pointer:fine)]:group-hover:flex">
        <button
          type="button"
          onClick={() => onToggleRead(message)}
          aria-label={
            message.is_read ? `Mark ${who} unread` : `Mark ${who} read`
          }
          title={message.is_read ? "Mark unread" : "Mark read"}
          className="rounded-control p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-ring"
        >
          {message.is_read ? (
            <Mail className="size-4" aria-hidden />
          ) : (
            <MailOpen className="size-4" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(message)}
          aria-label={message.is_archived ? `Restore ${who}` : `Archive ${who}`}
          title={message.is_archived ? "Restore" : "Archive"}
          className="rounded-control p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-ring"
        >
          {message.is_archived ? (
            <ArchiveRestore className="size-4" aria-hidden />
          ) : (
            <Archive className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </li>
  );
}
