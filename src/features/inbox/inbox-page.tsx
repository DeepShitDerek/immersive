"use client";

import { useUrlParam } from "@/hooks/use-url-param";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Bell,
  CheckCheck,
  Inbox as InboxIcon,
  MailOpen,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  useDeleteContactSubmissionMutation,
  useGetContactSubmissionsQuery,
  useUpdateContactSubmissionMutation,
  useUpdateContactSubmissionsMutation,
} from "@/store/api/adminApi";
import type { ContactSubmission } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EmptyState,
  LoadError,
  LoadingState,
  ManagerWrapper,
  ModuleTabs,
  PageHeader,
} from "@/components/admin/shared";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import { getErrorMessage } from "@/lib/utils";
import { useBelowBreakpoint } from "@/hooks/use-media-query";
import {
  INBOX_FILTERS,
  INBOX_SORTS,
  inboxCounts,
  nextSelection,
  visibleMessages,
  type InboxFilter,
  type InboxSort,
} from "./inbox-filters";
import { MessageList } from "./message-list";
import { MessageDetail } from "./message-detail";
import { NotificationSettings } from "./notification-settings";

/** One empty list for every render while the query has none (see Navigation). */
const NO_MESSAGES: ContactSubmission[] = [];

/** A delete waiting on its Undo: one toast, however many messages. */
interface PendingDelete {
  id: string;
  ids: string[];
}

/**
 * The contact inbox.
 *
 * List on the left, the message on the right; on a phone the message is its
 * own page with a back button (it was a sheet over the list). The four
 * states are derived in `inbox-filters.ts`, so the counts, the tabs and the
 * ordering cannot disagree.
 */
export default function InboxPage() {
  const {
    data: allMessages = NO_MESSAGES,
    isLoading,
    error: loadError,
    refetch,
  } = useGetContactSubmissionsQuery();
  const [updateMessage, { isLoading: isUpdating }] =
    useUpdateContactSubmissionMutation();
  const [updateMany] = useUpdateContactSubmissionsMutation();
  const [deleteMessage] = useDeleteContactSubmissionMutation();

  const [filter, setFilter] = useState<InboxFilter>("attention");
  // Newest first, like any mail client; oldest first is a choice.
  const [sort, setSort] = useState<InboxSort>("newest");
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // In the URL: a message can be linked to, and Back leaves it.
  const [selectedId, setSelectedId] = useUrlParam("message");
  /** Only a message the reader opened is marked read. */
  const [chosen, setChosen] = useState(false);
  /** Messages checked for a bulk action. */
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const narrow = useBelowBreakpoint("lg");

  // Deletes offer Undo instead of asking first: nothing leaves the
  // database until the toast closes.
  const pendingIds = useRef(new Map<string, string[]>());
  const { pending: deleting, remove: removeLater } =
    useUndoableDelete<PendingDelete>(async ({ ids }) => {
      const failed: string[] = [];
      for (const id of ids) {
        try {
          await deleteMessage(id).unwrap();
        } catch {
          failed.push(id);
        }
      }
      if (failed.length > 0) {
        toast.error(
          failed.length === 1
            ? "A message couldn't be deleted"
            : `${failed.length} messages couldn't be deleted`,
          { description: "They are back in the list." },
        );
      }
    });
  const hidden = useMemo(() => {
    const ids = new Set<string>();
    for (const key of deleting)
      for (const id of pendingIds.current.get(key) ?? []) ids.add(id);
    return ids;
  }, [deleting]);

  const messages = useMemo(
    () =>
      hidden.size ? allMessages.filter((m) => !hidden.has(m.id)) : allMessages,
    [allMessages, hidden],
  );
  const counts = useMemo(() => inboxCounts(messages), [messages]);
  const visible = useMemo(
    () => visibleMessages(messages, filter, search, sort),
    [messages, filter, search, sort],
  );
  const selected = useMemo(
    () => messages.find((message) => message.id === selectedId) ?? null,
    [messages, selectedId],
  );

  // A check only means something for a message on screen.
  useEffect(() => {
    setChecked((current) => {
      if (current.size === 0) return current;
      const onScreen = new Set(visible.map((m) => m.id));
      const next = new Set([...current].filter((id) => onScreen.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visible]);

  /**
   * Keep a selection that still exists in the current view. On a wide screen
   * the pane is filled with the first message; on a narrow one nothing opens
   * by itself, so the list stays reachable.
   */
  useEffect(() => {
    const next = nextSelection(
      visible.map((message) => message.id),
      selectedId,
      narrow,
    );
    if (next === undefined) return;
    setSelectedId(next, "replace");
    setChosen(false);
  }, [visible, selectedId, narrow]);

  /**
   * Opening a message marks it read, but read is not replied, so it stays in
   * "Needs reply". Only a message the reader chose.
   */
  useEffect(() => {
    if (chosen && selected && !selected.is_read) {
      void updateMessage({ id: selected.id, is_read: true });
    }
  }, [chosen, selected, updateMessage]);

  const patchOne = async (
    message: ContactSubmission,
    changes: Partial<ContactSubmission>,
  ) => {
    try {
      await updateMessage({ id: message.id, ...changes }).unwrap();
    } catch (error) {
      toast.error("Couldn't update the message", {
        description: getErrorMessage(error),
      });
    }
  };

  const patchMany = async (
    ids: string[],
    changes: Partial<ContactSubmission>,
    done: string,
  ) => {
    if (ids.length === 0) return;
    try {
      await updateMany({ ids, changes }).unwrap();
      toast.success(done);
    } catch (error) {
      toast.error("Couldn't update them", {
        description: getErrorMessage(error),
      });
    }
  };

  const deleteIds = (ids: string[]) => {
    if (ids.length === 0) return;
    const key = `delete-${ids.join(",")}-${Date.now()}`;
    pendingIds.current.set(key, ids);
    if (selectedId && ids.includes(selectedId)) setSelectedId(null, "replace");
    removeLater(
      { id: key, ids },
      ids.length === 1 ? "Message deleted" : `${ids.length} messages deleted`,
    );
  };

  const markAllRead = () =>
    void patchMany(
      messages.filter((m) => !m.is_read && !m.is_archived).map((m) => m.id),
      { is_read: true },
      "All marked read",
    );

  const checkedIds = [...checked];
  const clearChecks = () => setChecked(new Set());
  const allChecked =
    visible.length > 0 && visible.every((m) => checked.has(m.id));

  const header = (
    <PageHeader
      title="Inbox"
      description="Messages from the contact form."
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search name, address or message…"
      actions={
        <>
          {counts.unread > 0 && (
            <Button type="button" variant="outline" onClick={markAllRead}>
              <CheckCheck className="mr-2 size-4" aria-hidden />
              Mark all read
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="More inbox actions"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setNotificationsOpen(true)}>
                <Bell className="mr-2 size-4" aria-hidden /> Notifications…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );

  const notifications = (
    <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <NotificationSettings />
        </div>
      </SheetContent>
    </Sheet>
  );

  if (loadError && allMessages.length === 0) {
    return (
      <ManagerWrapper>
        {header}
        <LoadError what="the inbox" error={loadError} onRetry={refetch} />
        {notifications}
      </ManagerWrapper>
    );
  }

  if (isLoading) {
    return (
      <ManagerWrapper>
        {header}
        <LoadingState label="Loading messages" />
      </ManagerWrapper>
    );
  }

  const detail = selected && (
    <MessageDetail
      message={selected}
      onUpdate={(changes) => void patchOne(selected, changes)}
      onDelete={() => deleteIds([selected.id])}
      onBack={narrow ? () => setSelectedId(null, "replace") : undefined}
      busy={isUpdating}
    />
  );

  // On a phone the open message is the page (push navigation, like Notes).
  if (narrow && selected) {
    return (
      <ManagerWrapper>
        {/* The card fills the screen, so the reply bar sits at the bottom. */}
        <div className="flex min-h-[calc(100dvh-9rem)] flex-col [&>article]:flex-1">
          {detail}
        </div>
        {notifications}
      </ManagerWrapper>
    );
  }

  return (
    <ManagerWrapper>
      {header}

      {messages.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          variant="card"
          title="No messages yet"
          description="Anything sent through the contact form arrives here. Set up a Discord ping from Notifications so you hear about it when it does."
          action={{
            label: "Notifications",
            onClick: () => setNotificationsOpen(true),
            icon: Bell,
          }}
        />
      ) : (
        <>
          <ModuleTabs
            label="Inbox view"
            className="mb-3"
            tabs={INBOX_FILTERS.map((entry) => ({
              id: entry.id,
              label: `${entry.label} ${counts[entry.id]}`,
            }))}
            current={filter}
            onSelect={(next) => {
              setFilter(next);
              clearChecks();
            }}
          />

          {/*
            One row under the tabs: the sort, or, once anything is checked,
            what to do with the checked messages.
          */}
          <div className="mb-3 flex min-h-10 flex-wrap items-center gap-2">
            <Checkbox
              checked={
                allChecked ? true : checked.size > 0 ? "indeterminate" : false
              }
              onCheckedChange={(value) =>
                setChecked(
                  value === true
                    ? new Set(visible.map((m) => m.id))
                    : new Set(),
                )
              }
              aria-label={
                allChecked
                  ? "Clear the selection"
                  : "Select every message shown"
              }
              className="ml-3"
              disabled={visible.length === 0}
            />
            {checked.size > 0 ? (
              <div
                role="toolbar"
                aria-label="Selected messages"
                className="flex flex-1 flex-wrap items-center gap-1"
              >
                <span className="mr-1 text-sm font-medium tabular-nums">
                  {checked.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void patchMany(
                      checkedIds,
                      { is_read: true },
                      `${checkedIds.length} marked read`,
                    );
                    clearChecks();
                  }}
                >
                  <MailOpen className="mr-1.5 size-4" aria-hidden /> Mark read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void patchMany(
                      checkedIds,
                      { is_archived: filter !== "archived" },
                      filter === "archived"
                        ? `${checkedIds.length} restored`
                        : `${checkedIds.length} archived`,
                    );
                    clearChecks();
                  }}
                >
                  <Archive className="mr-1.5 size-4" aria-hidden />
                  {filter === "archived" ? "Restore" : "Archive"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    deleteIds(checkedIds);
                    clearChecks();
                  }}
                >
                  <Trash2 className="mr-1.5 size-4" aria-hidden /> Delete
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8"
                  aria-label="Clear the selection"
                  onClick={clearChecks}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <div className="ml-auto">
                <Select
                  value={sort}
                  onValueChange={(v) => setSort(v as InboxSort)}
                >
                  <SelectTrigger
                    className="h-9 w-auto min-w-[9rem]"
                    aria-label="Sort messages"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {INBOX_SORTS.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <MessageList
                messages={visible}
                selectedId={narrow ? null : selectedId}
                onSelect={(message) => {
                  setSelectedId(message.id);
                  setChosen(true);
                }}
                emptyMessage={
                  INBOX_FILTERS.find((entry) => entry.id === filter)?.empty ??
                  "Nothing here."
                }
                checked={checked}
                onCheck={(id, on) =>
                  setChecked((current) => {
                    const next = new Set(current);
                    if (on) next.add(id);
                    else next.delete(id);
                    return next;
                  })
                }
                onToggleRead={(message) =>
                  void patchOne(message, { is_read: !message.is_read })
                }
                onToggleArchive={(message) =>
                  void patchOne(message, { is_archived: !message.is_archived })
                }
              />
            </div>

            {!narrow && (
              <div className="min-w-0 lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
                {detail || (
                  <div className="flex h-full items-center justify-center rounded-surface border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Select a message to read it.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {notifications}
    </ManagerWrapper>
  );
}
