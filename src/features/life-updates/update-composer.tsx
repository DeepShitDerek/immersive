"use client";

import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useRef, useState } from "react";
import type React from "react";
import { ImagePlus, Link2, Loader2, Pin, X } from "lucide-react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import type { LifeUpdate } from "@/types";
import {
  useAddLifeUpdateMutation,
  useUpdateLifeUpdateMutation,
} from "@/store/api/adminApi";
import { supabase } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { lifeUpdateSchema } from "@/lib/schemas";
import { LIFE_UPDATE_CATEGORY_OPTIONS } from "@/lib/constants";
import { isKnownCategory } from "@/lib/life-update";
import { addTags } from "@/lib/tag-input";
import { safeImageUrl } from "@/lib/safe-url";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "@/features/updates/category-icon";

const BUCKET_NAME = process.env.NEXT_PUBLIC_BUCKET_NAME || "assets";

/**
 * Write an update where you read them.
 *
 * The old editor was a side sheet with a Select, a Switch and a tag string to
 * separate with commas — six controls and a save button between having a
 * thought and posting it. This is a composer: pick a kind, write, press
 * Publish. It sits at the top of the module for a new update, and replaces an
 * entry in place when that entry is edited, so editing happens in the list
 * rather than in a panel that covers it.
 *
 * Two actions instead of a Published switch: **Publish** (or **Save**, for an
 * update already live) and **Save draft** (or **Move to drafts**). A switch
 * made publishing a setting to remember; a button makes it the thing you do.
 */
export function UpdateComposer({
  update,
  onDone,
  onCancel,
  autoFocus = false,
}: {
  update?: LifeUpdate | null;
  /** After a successful save. */
  onDone?: () => void;
  /** Shown as Cancel when given — the edit-in-place case. */
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const isEdit = Boolean(update?.id);
  const wasPublished = update?.is_published ?? false;

  // Seeded at mount; the page keys the composer by row id.
  const [title, setTitle] = useState(() => update?.title ?? "");
  const [content, setContent] = useState(() => update?.content ?? "");
  const [category, setCategory] = useState<string>(
    () => update?.category || "thought",
  );
  const [imageUrl, setImageUrl] = useState(() => update?.image_url ?? "");
  const [showUrlField, setShowUrlField] = useState(false);
  const [tags, setTags] = useState<string[]>(() => update?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [isPinned, setIsPinned] = useState(() => update?.is_pinned ?? false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  const [addLifeUpdate, { isLoading: isAdding }] = useAddLifeUpdateMutation();
  const [updateLifeUpdate, { isLoading: isUpdating }] =
    useUpdateLifeUpdateMutation();
  const isSaving = isAdding || isUpdating;

  const isEmpty = !title.trim() && !content.trim() && !imageUrl.trim();

  const dirty = isEdit
    ? title !== (update?.title ?? "") ||
      content !== (update?.content ?? "") ||
      imageUrl !== (update?.image_url ?? "") ||
      tags.join("|") !== (update?.tags ?? []).join("|")
    : !isEmpty || tags.length > 0;
  useUnsavedGuard(dirty && !isSaving);

  /**
   * A row can hold a category outside the five — the CHECK constraint arrived
   * after the column did. It is shown, flagged, rather than silently replaced
   * by whichever option happened to be first; it cannot be saved.
   */
  const options = isKnownCategory(category)
    ? [...LIFE_UPDATE_CATEGORY_OPTIONS]
    : [
        ...LIFE_UPDATE_CATEGORY_OPTIONS,
        { value: category, label: `${category} (unrecognised)` },
      ];

  const previewUrl = safeImageUrl(imageUrl);

  const reset = () => {
    setTitle("");
    setContent("");
    setCategory("thought");
    setImageUrl("");
    setShowUrlField(false);
    setTags([]);
    setTagDraft("");
    setIsPinned(false);
    setError(null);
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image.");
      return;
    }
    if (!supabase) {
      toast.error("No database connection, so images can't be uploaded.");
      return;
    }
    setIsUploading(true);

    let upload = file;
    try {
      upload = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.8,
      });
    } catch {
      toast.warning("Couldn't compress the image; uploading the original.");
    }

    // Timestamp-prefixed and reduced to a safe character set, so the segment
    // can never be a traversal like `..`.
    const safeName = upload.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/__+/g, "_");
    const path = `life_updates/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, upload);
    setIsUploading(false);

    if (uploadError) {
      toast.error("Upload failed", { description: uploadError.message });
      return;
    }
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setShowUrlField(false);
  };

  const commitTagDraft = (): string[] => {
    if (!tagDraft.trim()) return tags;
    const next = addTags(tags, tagDraft);
    setTags(next);
    setTagDraft("");
    return next;
  };

  const submit = async (publish: boolean) => {
    if (isEmpty || isSaving || isUploading) return;
    const finalTags = commitTagDraft();

    if (!isKnownCategory(category)) {
      setError(
        `"${category}" isn't a category the site recognises — pick one of the five.`,
      );
      return;
    }

    const data: Partial<LifeUpdate> = {
      title: title.trim() || null,
      content: content.trim() || null,
      category: category as LifeUpdate["category"],
      image_url: imageUrl.trim() || null,
      tags: finalTags.length > 0 ? finalTags : null,
      is_pinned: isPinned,
      is_published: publish,
    };

    // Plain state rather than react-hook-form, so the shared schema is what
    // checks lengths and the tag count before Postgres does.
    const parsed = lifeUpdateSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the update.");
      return;
    }
    setError(null);

    try {
      if (update?.id) {
        await updateLifeUpdate({ ...data, id: update.id }).unwrap();
      } else {
        await addLifeUpdate(data).unwrap();
      }
      toast.success(
        !publish
          ? "Saved to drafts."
          : isEdit && wasPublished
            ? "Update saved."
            : "Published.",
      );
      if (!isEdit) reset();
      onDone?.();
    } catch (err: unknown) {
      toast.error("Couldn't save the update", {
        description: getErrorMessage(err),
      });
    }
  };

  const onRadioKey = (event: React.KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    setCategory(options[next].value);
    radios.current[next]?.focus();
  };

  const primaryLabel = isEdit && wasPublished ? "Save" : "Publish";
  const secondaryLabel =
    isEdit && wasPublished ? "Move to drafts" : "Save draft";
  const disabled = isEmpty || isSaving || isUploading;

  return (
    <form
      aria-label={isEdit ? "Edit update" : "New update"}
      onSubmit={(event) => {
        event.preventDefault();
        submit(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          submit(true);
        }
        if (event.key === "Escape" && onCancel) onCancel();
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        const file = event.dataTransfer.files?.[0];
        setIsDragging(false);
        if (!file) return;
        event.preventDefault();
        uploadImage(file);
      }}
      className={cn(
        "rounded-surface bg-card p-4 shadow-e2 transition-shadow sm:p-5",
        isDragging && "ring-2 ring-primary",
      )}
    >
      <div
        role="radiogroup"
        aria-label="Category"
        className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5"
      >
        {options.map((option, index) => {
          const selected = option.value === category;
          return (
            <button
              key={option.value}
              ref={(node) => {
                radios.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setCategory(option.value)}
              onKeyDown={(event) => onRadioKey(event, index)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                "focus-ring",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
              )}
            >
              <CategoryIcon category={option.value} />
              {option.label}
            </button>
          );
        })}
      </div>

      <Input
        aria-label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title (optional)"
        className="mt-4 h-auto border-0 bg-transparent px-0 py-1 text-lg font-semibold shadow-none placeholder:font-normal placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <Textarea
        aria-label="Update"
        value={content}
        autoFocus={autoFocus}
        onChange={(event) => setContent(event.target.value)}
        onPaste={(event) => {
          const file = event.clipboardData?.files?.[0];
          if (file?.type.startsWith("image/")) {
            event.preventDefault();
            uploadImage(file);
          }
        }}
        placeholder="What's happening? Markdown works."
        rows={3}
        className="min-h-[5rem] resize-none border-0 bg-transparent px-0 py-1 text-base shadow-none [field-sizing:content] focus-visible:ring-0 focus-visible:ring-offset-0"
      />

      {imageUrl.trim() && (
        <div className="mt-3">
          {previewUrl ? (
            <div className="relative inline-block max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Attached"
                className="max-h-64 max-w-full rounded-control bg-secondary object-cover"
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Remove image"
                onClick={() => setImageUrl("")}
                className="absolute right-2 top-2 size-7 rounded-full"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-destructive">
              The site only shows images from an http(s) address, so this one
              won&apos;t appear.
            </p>
          )}
        </div>
      )}

      {showUrlField && (
        <Input
          aria-label="Image address"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://…"
          className="mt-3"
        />
      )}

      <TagInput
        tags={tags}
        onTagsChange={setTags}
        draft={tagDraft}
        onDraftChange={setTagDraft}
        placeholder="#Add tags"
        className="mt-3"
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          {/* sr-only rather than hidden, so the file input stays in the tab order. */}
          <label
            className="rounded-control focus-within:ring-2 focus-within:ring-ring"
            title="Add a photo (or drop / paste one)"
          >
            <input
              type="file"
              accept="image/*"
              aria-label="Add a photo"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadImage(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Add a photo"
              asChild
            >
              <span>
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="size-4" aria-hidden />
                )}
              </span>
            </Button>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Use an image address"
            aria-pressed={showUrlField}
            title="Use an image address"
            onClick={() => setShowUrlField((shown) => !shown)}
          >
            <Link2 className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Pin to the top of /updates"
            aria-pressed={isPinned}
            title={isPinned ? "Pinned" : "Pin to the top of /updates"}
            onClick={() => setIsPinned((pinned) => !pinned)}
            className={cn(isPinned && "bg-primary/10 text-primary")}
          >
            <Pin className="size-4" aria-hidden />
          </Button>
        </div>

        <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
          Ctrl + Enter to {primaryLabel.toLowerCase()}
        </span>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => submit(false)}
          >
            {secondaryLabel}
          </Button>
          <Button type="submit" disabled={disabled}>
            {isSaving && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            {primaryLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
