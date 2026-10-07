"use client";

import { format } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Copy,
  Mail,
  MailOpen,
  MoreHorizontal,
  Reply,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { ContactSubmission } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contactTopicLabel } from "@/lib/contact-topics";
import { messageState, replyMailto } from "./inbox-filters";

/**
 * One message: a tool header (back on a phone ·
 * subject · ⋯), who sent it, the message at a reading measure, and the reply
 * bar at the bottom.
 *
 * There is no reply box. The app has no outbox and no sending domain, so a
 * compose form here would be a worse mail client — Reply opens whatever the
 * owner already sends mail from, with the thread quoted.
 */
export function MessageDetail({
  message,
  onUpdate,
  onDelete,
  onBack,
  busy,
}: {
  message: ContactSubmission;
  onUpdate: (changes: Partial<ContactSubmission>) => void;
  /** Deletes with Undo; the page owns that. */
  onDelete: () => void;
  /** On a phone the message is its own page, with a way back to the list. */
  onBack?: () => void;
  busy: boolean;
}) {
  const state = messageState(message);
  const topic = contactTopicLabel(message.topic);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(message.email);
      toast.success("Email address copied");
    } catch {
      toast.error("Couldn't copy", {
        description: "Your browser blocked clipboard access.",
      });
    }
  };

  return (
    <article className="flex h-full flex-col rounded-surface border bg-card">
      <header className="flex items-start gap-2 border-b p-3 sm:p-4">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Back to the inbox"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
        )}
        <div className="min-w-0 flex-1 pt-1.5">
          {topic && <p className="t-eyebrow mb-1">{topic}</p>}
          <h2 className="break-words text-lg font-semibold leading-tight text-foreground">
            {message.subject}
          </h2>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label="More actions for this message"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => void copyEmail()}>
              <Copy className="mr-2 size-4" aria-hidden /> Copy address
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onUpdate({ is_read: !message.is_read })}
            >
              {message.is_read ? (
                <Mail className="mr-2 size-4" aria-hidden />
              ) : (
                <MailOpen className="mr-2 size-4" aria-hidden />
              )}
              {message.is_read ? "Mark unread" : "Mark read"}
            </DropdownMenuItem>
            {message.replied_at && (
              <DropdownMenuItem onSelect={() => onUpdate({ replied_at: null })}>
                <MailOpen className="mr-2 size-4" aria-hidden /> Mark unanswered
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 className="mr-2 size-4" aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Who, and when: the sender card. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-foreground">{message.name}</span>
          <a
            href={`mailto:${message.email}`}
            className="min-w-0 break-all text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {message.email}
          </a>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <time dateTime={message.created_at}>
            {format(new Date(message.created_at), "d MMM yyyy, HH:mm")}
          </time>
          {message.replied_at && (
            <>
              {" · replied "}
              <time dateTime={message.replied_at}>
                {format(new Date(message.replied_at), "d MMM yyyy")}
              </time>
            </>
          )}
        </p>

        {/*
          Plain text on purpose: the one field in the app written by a
          stranger, so no markdown pipeline. pre-wrap keeps their paragraphs,
          break-words survives one 5,000-character token.
        */}
        <p className="mt-5 max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {message.message}
        </p>
      </div>

      {/* The reply bar: at the bottom of the pane, always in reach. */}
      <footer className="flex flex-wrap items-center gap-2 border-t p-3 sm:p-4">
        <Button asChild size="sm" disabled={busy}>
          <a
            href={replyMailto(message)}
            onClick={() => {
              // Marked on click: nothing tells the page whether the mail went,
              // and "Mark unanswered" in ⋯ undoes it.
              if (!message.replied_at) {
                onUpdate({ replied_at: new Date().toISOString() });
              }
            }}
          >
            <Reply className="mr-1.5 size-4" aria-hidden />
            Reply
          </a>
        </Button>
        {!message.replied_at && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onUpdate({ replied_at: new Date().toISOString() })}
          >
            <Check className="mr-1.5 size-4" aria-hidden />
            Mark replied
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onUpdate({ is_archived: !message.is_archived })}
        >
          {state === "archived" ? (
            <>
              <ArchiveRestore className="mr-1.5 size-4" aria-hidden />
              Restore
            </>
          ) : (
            <>
              <Archive className="mr-1.5 size-4" aria-hidden />
              Archive
            </>
          )}
        </Button>
      </footer>
    </article>
  );
}
