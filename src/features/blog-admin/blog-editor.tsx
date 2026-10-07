"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  EyeOff,
  ImagePlus,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelRight,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { BlogPost } from "@/types";
import {
  useAddBlogPostMutation,
  useUpdateBlogPostMutation,
} from "@/store/api/adminApi";
import NovelEditor from "@/components/admin/novel-editor";
import type { NovelEditorHandle } from "@/components/admin/novel-editor/novel-editor";
import { supabase } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { useMediaQuery } from "@/hooks/use-media-query";
import { safeImageUrl } from "@/lib/safe-url";
import { getErrorMessage, readTimeFromWordCount } from "@/lib/utils";
import { cn } from "@/lib/cn";
import {
  countWords,
  draftFromPost,
  postProblems,
  PUBLISHED_UNTIL_DEPLOY,
  recordFromDraft,
  sameDraft,
  slugify,
  type PostDraft,
} from "./post-draft";
import {
  clearRecovery,
  keepRecovery,
  readRecovery,
  type Recovery,
  recoveryKey,
} from "./post-recovery";
import { livePath, PostStatusBadge } from "./post-list";
import { PostSettingsPanel } from "./post-settings-panel";
import { useBlogImageUpload } from "./use-blog-image-upload";

/** A draft saves itself this long after typing stops. */
const DRAFT_AUTOSAVE_DELAY = 1500;

const SETTINGS_FIELDS = ["slug", "tags", "cover_image_url", "internal_notes"];

interface BlogEditorProps {
  /** Null for a new post. Read once, at mount. */
  post: BlogPost | null;
  onClose: () => void;
  /** The row a new post became on its first save. */
  onCreated: (post: BlogPost) => void;
  onDelete: (post: BlogPost) => void;
}

function saveFailure(err: unknown): { field?: string; text: string } {
  const text = getErrorMessage(err);
  const code = (err as { code?: string } | null)?.code;
  if (code === "23505" || /duplicate key|already exists/i.test(text)) {
    return {
      field: "slug",
      text: "Another post already uses this address — change the slug in Settings.",
    };
  }
  return { text };
}

/**
 * Writing a post.
 *
 * The post is the page: cover, title, subtitle and body in one reading column
 * on the page ground, with the rest of the chrome in a bar above it and the
 * settings beside it. It used to be a card holding a title field and a framed
 * editor, with the subtitle, tags and cover behind a sheet laid over the text.
 *
 * Saving follows what a post is:
 *
 * - **A draft saves itself** once it has a title, a moment after typing stops.
 *   Nothing reads a draft, so there is nothing to protect by asking.
 * - **A published post waits for Update.** Its edits are live the moment they
 *   are written, so they are held until you say so, the bar says "Unpublished
 *   changes", and leaving asks before discarding them.
 *
 * Every write goes through `blogPostSchema` first, and `published_at` is kept
 * across updates — it is the date readers see.
 */
export default function BlogEditor({
  post,
  onClose,
  onCreated,
  onDelete,
}: BlogEditorProps) {
  const confirm = useConfirm();
  const [addBlogPost] = useAddBlogPostMutation();
  const [updateBlogPost] = useUpdateBlogPostMutation();
  const { isUploading, uploadImage } = useBlogImageUpload();
  const isWide = useMediaQuery("(min-width: 1280px)");

  const [current, setCurrent] = useState<BlogPost | null>(post);
  const currentRef = useRef(current);
  currentRef.current = current;
  const [draft, setDraft] = useState<PostDraft>(() => draftFromPost(post));
  const latest = useRef(draft);
  latest.current = draft;
  const savedDraft = useRef<PostDraft>(draftFromPost(post));

  // The slug follows the title until someone edits it, or the post has been
  // public — an address readers may have shared is never changed by retitling.
  const slugLocked = useRef(
    !!post &&
      (!!post.published ||
        !!post.published_at ||
        post.slug !== slugify(post.title)),
  );

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const subtitleRef = useRef<HTMLTextAreaElement>(null);
  const editorHandle = useRef<NovelEditorHandle | null>(null);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  const published = !!current?.published;
  const dirty = !sameDraft(draft, savedDraft.current);

  // Unsaved edits kept from the last time this post was open.
  const [recovery, setRecovery] = useState<Recovery | null>(() =>
    readRecovery(post),
  );
  /** Set when the owner chose to discard; closing then keeps nothing. */
  const discarded = useRef(false);
  const words = countWords(draft.content);

  const change = (patch: Partial<PostDraft>) => {
    if (patch.slug !== undefined) slugLocked.current = true;
    setDraft((previous) => {
      const next = { ...previous, ...patch };
      if (patch.title !== undefined && !slugLocked.current) {
        next.slug = slugify(patch.title);
      }
      return next;
    });
  };

  const save = useCallback(
    async ({ publish, quiet }: { publish: boolean; quiet: boolean }) => {
      if (savingRef.current) return false;
      const snapshot = latest.current;
      const previous = currentRef.current;
      const record = recordFromDraft(snapshot, publish, previous);

      const problems = postProblems(record, publish);
      setErrors(problems);
      if (Object.keys(problems).length > 0) {
        if (!quiet) {
          toast.error(publish ? "Not ready to publish" : "Can't save yet", {
            description: Object.values(problems)[0],
          });
          if (Object.keys(problems).some((f) => SETTINGS_FIELDS.includes(f))) {
            setSettingsOpen(true);
          }
        }
        return false;
      }

      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const result = previous?.id
          ? await updateBlogPost({ ...record, id: previous.id }).unwrap()
          : await addBlogPost(record).unwrap();
        savedDraft.current = snapshot;
        setCurrent(result);
        if (!previous?.id) onCreatedRef.current(result);
        setSavedAt(new Date());
        if (!quiet) {
          if (supabase) void supabase.rpc("update_asset_usage");
          const firstPublish = publish && !previous?.published;
          toast.success(
            firstPublish
              ? "Published."
              : !publish && previous?.published
                ? "Moved back to drafts."
                : publish
                  ? "Update published."
                  : "Saved.",
            firstPublish ? { description: PUBLISHED_UNTIL_DEPLOY } : undefined,
          );
        }
        return true;
      } catch (err) {
        const failure = saveFailure(err);
        if (failure.field) {
          setErrors((e) => ({ ...e, [failure.field!]: failure.text }));
          setSettingsOpen(true);
        }
        setSaveError(failure.text);
        if (!quiet) {
          toast.error("Couldn't save the post", { description: failure.text });
        }
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [addBlogPost, updateBlogPost],
  );
  const saveRef = useRef(save);
  saveRef.current = save;

  // Drafts save themselves; a published post waits for Update.
  useEffect(() => {
    if (!dirty || published || saving || saveError) return;
    if (!draft.title.trim()) return;
    const timer = setTimeout(
      () => void saveRef.current({ publish: false, quiet: true }),
      DRAFT_AUTOSAVE_DELAY,
    );
    return () => clearTimeout(timer);
  }, [draft, dirty, published, saving, saveError]);

  // A new edit is a new attempt.
  useEffect(() => {
    setSaveError(null);
  }, [draft]);

  // Saved: nothing left to recover.
  useEffect(() => {
    if (savedAt) clearRecovery(recoveryKey(currentRef.current));
  }, [savedAt]);

  /**
   * Leaving through the sidebar, launcher or palette unmounts the editor
   * without asking. Keep what is unsaved in this browser, and save a
   * titled draft on the way out, as notes do. A published post is never saved
   * here: that would change the live post, so its edits wait to be restored.
   */
  useEffect(
    () => () => {
      const unsaved = latest.current;
      if (discarded.current || sameDraft(unsaved, savedDraft.current)) return;
      const key = recoveryKey(currentRef.current);
      keepRecovery(key, unsaved);
      if (
        !currentRef.current?.published &&
        unsaved.title.trim() &&
        !savingRef.current
      ) {
        void saveRef.current({ publish: false, quiet: true }).then((ok) => {
          if (ok) clearRecovery(key);
        });
      }
    },
    [],
  );

  // A closed tab or a reload runs no cleanup, so ask while anything is unsaved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Escape leaves focus mode — the button that entered it is hidden by it.
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  // Chosen, not accidental: nothing is kept to be offered back.
  const discardAndClose = () => {
    discarded.current = true;
    clearRecovery(recoveryKey(currentRef.current));
    onClose();
  };

  const leave = async () => {
    if (!dirty) return onClose();
    if (published) {
      const ok = await confirm({
        title: "Leave without updating?",
        description:
          "Your changes to this published post haven't been published. Leaving discards them.",
        confirmText: "Discard changes",
        variant: "destructive",
      });
      if (ok) discardAndClose();
      return;
    }
    if (!draft.title.trim()) {
      if (!draft.content.trim() && !draft.excerpt.trim())
        return discardAndClose();
      const ok = await confirm({
        title: "Discard this draft?",
        description: "It has no title yet, so it can't be saved.",
        confirmText: "Discard",
        variant: "destructive",
      });
      if (ok) discardAndClose();
      return;
    }
    if (await save({ publish: false, quiet: true })) return onClose();
    const ok = await confirm({
      title: "Leave without saving?",
      description:
        "This draft couldn't be saved, so your latest changes would be lost.",
      confirmText: "Leave anyway",
      variant: "destructive",
    });
    if (ok) discardAndClose();
  };

  const onCoverFile = async (file: File) => {
    const url = await uploadImage(file);
    if (url) change({ cover_image_url: url });
  };

  const cover = safeImageUrl(draft.cover_image_url);
  const needsAttention = dirty && Object.keys(errors).length > 0;
  const status = saving
    ? "Saving…"
    : saveError
      ? `Not saved — ${saveError}`
      : needsAttention
        ? `Needs attention — ${Object.values(errors)[0]}`
        : dirty
          ? published
            ? "Unpublished changes"
            : draft.title.trim()
              ? "Saving…"
              : "Add a title to save"
          : savedAt
            ? "Saved"
            : current?.updated_at
              ? `Edited ${formatDistanceToNow(new Date(current.updated_at), { addSuffix: true })}`
              : "New post";

  const panel = (
    <PostSettingsPanel
      draft={draft}
      onChange={change}
      errors={errors}
      publishedAt={published ? current?.published_at : null}
      onCoverFile={onCoverFile}
      isUploading={isUploading}
    />
  );

  return (
    <div
      className={cn(
        // Focus mode covers the admin chrome, which this page does not own,
        // rather than reaching up into the shell to hide it.
        focusMode &&
          "fixed inset-0 z-rail overflow-y-auto bg-background px-4 sm:px-6",
      )}
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          void save({ publish: published, quiet: false });
        }
      }}
    >
      {/* Pinned under the admin topbar (h-14), in the same fill. -mt-6
          cancels the shell's py-6, which left a strip of page background
          between the two bars until the page was scrolled. */}
      <div
        className={cn(
          "sticky top-14 z-sticky -mx-4 -mt-6 flex h-14 items-center gap-2 border-b bg-card px-4 sm:-mx-6 sm:px-6",
          focusMode && "hidden",
        )}
        // Full-bleed fill and rule. The bar stops at the page column (84rem at
        // most); with the app launcher on a wide screen that column is
        // narrower than the window, and the page ground showed beside the bar.
        // A border image with a horizontal outset paints the card fill and the
        // 1px rule out to the window's edges; paint outside the box is ink
        // overflow, so it adds no scrolling and moves nothing. Under the
        // sidebar rail the extra lies behind the rail.
        style={{
          borderImage:
            "linear-gradient(to bottom, hsl(var(--card)) calc(100% - 1px), hsl(var(--border)) calc(100% - 1px)) fill 0 / 0 / 0 100vmax",
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={leave}
          className="-ml-2 shrink-0"
        >
          <ArrowLeft className="mr-1.5 size-4" aria-hidden /> Posts
        </Button>
        <PostStatusBadge published={published} />
        <span
          aria-live="polite"
          className={cn(
            "min-w-0 truncate text-xs",
            saveError || needsAttention
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {status}
        </span>

        <span className="ml-auto hidden shrink-0 text-xs tabular-nums text-muted-foreground lg:inline">
          {words.toLocaleString()} words · {readTimeFromWordCount(words)} min
          read
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Focus"
            title="Hide everything but the post — Escape to come back"
            onClick={() => setFocusMode(true)}
            className="size-9"
          >
            <Maximize2 className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant={settingsOpen ? "secondary" : "ghost"}
            size="icon"
            aria-label="Post settings"
            aria-pressed={settingsOpen}
            title="Post settings"
            onClick={() => setSettingsOpen((open) => !open)}
            className="size-9"
          >
            <PanelRight className="size-4" aria-hidden />
          </Button>

          {current?.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="More actions"
                  className="size-9"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {published && (
                  <>
                    <DropdownMenuItem asChild>
                      <a
                        href={livePath(current)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 size-4" aria-hidden />{" "}
                        View live
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            new URL(
                              livePath(current),
                              window.location.origin,
                            ).toString(),
                          );
                          toast.success("Link copied.");
                        } catch {
                          toast.error("Couldn't copy the link.");
                        }
                      }}
                    >
                      <Copy className="mr-2 size-4" aria-hidden /> Copy link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        void save({ publish: false, quiet: false })
                      }
                    >
                      <EyeOff className="mr-2 size-4" aria-hidden /> Unpublish
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onDelete(current)}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden /> Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {published ? (
            <Button
              onClick={() => void save({ publish: true, quiet: false })}
              disabled={!dirty || saving || isUploading}
            >
              {saving && (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              )}
              Update
            </Button>
          ) : (
            <Button
              onClick={() => void save({ publish: true, quiet: false })}
              disabled={saving || isUploading}
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="mr-2 size-4" aria-hidden />
              )}
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* The one control focus mode leaves on screen. */}
      {focusMode && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setFocusMode(false)}
          className="fixed right-4 top-4 z-overlay shadow-e2"
        >
          <Minimize2 className="mr-1.5 size-3.5" aria-hidden />
          Done
          <kbd className="ml-2 hidden text-micro text-muted-foreground sm:inline">
            Esc
          </kbd>
        </Button>
      )}

      <div
        className={cn(
          "mx-auto flex w-full items-start gap-10",
          settingsOpen && isWide && !focusMode ? "max-w-6xl" : "max-w-4xl",
        )}
      >
        <div className="min-w-0 flex-1 pb-32 pt-8 sm:pt-12">
          <div className="mx-auto max-w-[46rem]">
            {recovery && (
              <div
                role="status"
                className="mb-6 flex flex-wrap items-center gap-3 rounded-surface border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
              >
                <span className="min-w-0 flex-1">
                  Changes you hadn&apos;t saved were kept when you left this
                  post on{" "}
                  {new Date(recovery.at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  .
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setDraft(recovery.draft);
                    setRecovery(null);
                  }}
                >
                  Restore
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearRecovery(recoveryKey(post));
                    setRecovery(null);
                  }}
                >
                  Discard
                </Button>
              </div>
            )}
            {cover ? (
              <div className="group relative mb-8 overflow-hidden rounded-surface bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover}
                  alt=""
                  className="aspect-[2/1] w-full object-cover"
                />
                <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => coverInput.current?.click()}
                  >
                    Change cover
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => change({ cover_image_url: "" })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInput.current?.click()}
                className="-ml-2 mb-4 inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-ring"
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="size-4" aria-hidden />
                )}
                Add cover
              </button>
            )}
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onCoverFile(file);
                event.target.value = "";
              }}
            />

            <textarea
              aria-label="Post title"
              aria-invalid={!!errors.title}
              rows={1}
              value={draft.title}
              onChange={(event) => change({ title: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  subtitleRef.current?.focus();
                }
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- a new post starts at its title
              autoFocus={!post}
              placeholder="Post title"
              className="block w-full resize-none overflow-hidden bg-transparent font-heading text-4xl font-bold leading-tight tracking-tight text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/40 sm:text-5xl"
            />
            {errors.title && dirty && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {errors.title}
              </p>
            )}

            <textarea
              ref={subtitleRef}
              aria-label="Subtitle"
              rows={1}
              value={draft.excerpt}
              onChange={(event) => change({ excerpt: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  editorHandle.current?.focus("start");
                }
              }}
              placeholder="Add a subtitle — it's also the summary in previews and search"
              className="mt-3 block w-full resize-none overflow-hidden bg-transparent text-lg leading-snug text-muted-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/50 sm:text-xl"
            />
            {errors.excerpt && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {errors.excerpt}
              </p>
            )}
            <p className="mt-4 truncate text-xs text-muted-foreground">
              /blog/view/?slug={draft.slug || "…"}
            </p>
          </div>

          <div className="mt-8">
            <NovelEditor
              value={draft.content}
              onChange={(content) => change({ content })}
              onImageUpload={uploadImage}
              placeholder="Tell the story — '/' for blocks, or paste an image…"
              minHeight="50vh"
              measure="prose"
              handleRef={editorHandle}
            />
          </div>
          {errors.content && (
            <p
              role="alert"
              className="mx-auto mt-3 max-w-[46rem] text-sm text-destructive"
            >
              {errors.content}
            </p>
          )}
        </div>

        {settingsOpen && isWide && !focusMode && (
          <aside
            aria-label="Post settings"
            className="sticky top-32 mt-8 max-h-[calc(100dvh-9rem)] w-80 shrink-0 overflow-y-auto rounded-surface border bg-card p-5"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Post settings</h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
                className="size-8"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            {panel}
          </aside>
        )}
      </div>

      {!isWide && (
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Post settings</SheetTitle>
              <SheetDescription>
                Address, search preview, tags, cover and notes.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">{panel}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
