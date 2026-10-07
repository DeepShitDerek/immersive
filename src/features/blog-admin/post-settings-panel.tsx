"use client";

import { useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { safeImageUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import { slugify, type PostDraft } from "./post-draft";

/**
 * Everything about a post that is not the writing: its address, how it looks
 * in a search result, tags, cover, table of contents and notes to self.
 *
 * Beside the post on a wide screen rather than in a sheet laid over it, so the
 * search preview updates as the title and subtitle are written. The subtitle
 * itself is edited under the title — it is part of the post, not a setting.
 *
 * Publishing is not here: it is the action this module exists for, and lives
 * on the editor's bar.
 */
export function PostSettingsPanel({
  draft,
  onChange,
  errors = {},
  publishedAt,
  onCoverFile,
  isUploading,
  className,
}: {
  draft: PostDraft;
  onChange: (patch: Partial<PostDraft>) => void;
  errors?: Record<string, string>;
  publishedAt?: string | null;
  onCoverFile: (file: File) => void;
  isUploading?: boolean;
  className?: string;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const cover = safeImageUrl(draft.cover_image_url);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/blog/view/?slug=${draft.slug || "…"}`;
  const searchTitle = draft.title.trim() || "Post title";
  const description =
    draft.excerpt.trim() ||
    "Add a subtitle under the title — it becomes this description.";

  return (
    <div className={cn("space-y-7", className)}>
      <Section title="Address">
        <Label htmlFor="post-slug" className="text-xs text-muted-foreground">
          Slug
        </Label>
        <div className="mt-1.5 flex gap-1.5">
          <Input
            id="post-slug"
            value={draft.slug}
            aria-invalid={!!errors.slug}
            aria-describedby={errors.slug ? "post-slug-error" : undefined}
            onChange={(event) => onChange({ slug: event.target.value })}
            className={cn(
              "h-9",
              errors.slug &&
                "border-destructive focus-visible:ring-destructive",
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Match the title"
            title="Match the title"
            onClick={() => onChange({ slug: slugify(draft.title) })}
            className="size-9 shrink-0"
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>
        {errors.slug ? (
          <p id="post-slug-error" className="mt-1.5 text-xs text-destructive">
            {errors.slug}
          </p>
        ) : (
          <p className="mt-1.5 break-all text-xs text-muted-foreground">
            {url}
          </p>
        )}
      </Section>

      <Section title="Search preview">
        <div className="rounded-control bg-secondary/50 p-3">
          <p className="truncate text-xs text-muted-foreground">{url}</p>
          <p className="mt-1 line-clamp-1 break-words text-base font-medium text-primary">
            {searchTitle}
          </p>
          <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Title {searchTitle.length}/60 · Description{" "}
          {draft.excerpt.trim().length}
          /160
        </p>
      </Section>

      <Section title="Tags">
        <TagInput
          tags={draft.tags}
          onTagsChange={(tags) => onChange({ tags })}
          draft={tagDraft}
          onDraftChange={setTagDraft}
          placeholder="Add a tag"
        />
        {errors.tags && (
          <p className="mt-1.5 text-xs text-destructive">{errors.tags}</p>
        )}
      </Section>

      <Section title="Cover">
        {cover && (
          <div className="relative mb-2 overflow-hidden rounded-control bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt="Cover"
              className="aspect-[16/9] w-full object-cover"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Remove cover"
              onClick={() => onChange({ cover_image_url: "" })}
              className="absolute right-2 top-2 size-7 rounded-full"
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>
        )}
        <div className="flex gap-1.5">
          <Input
            aria-label="Cover image address"
            placeholder="https://…"
            value={draft.cover_image_url}
            onChange={(event) =>
              onChange({ cover_image_url: event.target.value })
            }
            className="h-9"
          />
          {/* sr-only rather than hidden, so the file input stays in the tab order. */}
          <label className="rounded-control focus-within:ring-2 focus-within:ring-ring">
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              aria-label="Upload a cover"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onCoverFile(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Upload a cover"
              className="size-9"
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
        </div>
        {draft.cover_image_url.trim() && !cover && (
          <p className="mt-1.5 text-xs text-destructive">
            The site only shows images from an http(s) address.
          </p>
        )}
        {errors.cover_image_url && (
          <p className="mt-1.5 text-xs text-destructive">
            {errors.cover_image_url}
          </p>
        )}
      </Section>

      <Section title="Reading">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="post-toc" className="text-sm font-normal">
            Table of contents
            <span className="block text-xs text-muted-foreground">
              Headings listed beside the post.
            </span>
          </Label>
          <Switch
            id="post-toc"
            checked={draft.show_toc}
            onCheckedChange={(checked) => onChange({ show_toc: checked })}
          />
        </div>
      </Section>

      <Section title="Notes to self">
        <Textarea
          aria-label="Notes to self"
          rows={4}
          value={draft.internal_notes}
          onChange={(event) => onChange({ internal_notes: event.target.value })}
          placeholder="Ideas, sources, what's left to do — never shown."
          className="resize-none"
        />
        {errors.internal_notes && (
          <p className="mt-1.5 text-xs text-destructive">
            {errors.internal_notes}
          </p>
        )}
      </Section>

      {publishedAt && (
        <p className="text-xs text-muted-foreground">
          Published {format(new Date(publishedAt), "d MMM yyyy, h:mm a")}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
