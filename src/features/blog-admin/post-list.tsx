"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  Copy,
  ExternalLink,
  EyeOff,
  FileText,
  Globe,
  MoreHorizontal,
  PenLine,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { BlogPost } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { readTimeFromWordCount } from "@/lib/utils";
import { safeImageUrl } from "@/lib/safe-url";

export interface PostActions {
  onEdit: (post: BlogPost) => void;
  onToggleStatus: (post: BlogPost) => void;
  onDelete: (post: BlogPost) => void;
}

/** Where a published post lives on the public site. */
export function livePath(post: Pick<BlogPost, "slug">): string {
  return `/blog/view/?slug=${encodeURIComponent(post.slug)}`;
}

/** Published posts say when they went out; drafts say when they were last touched. */
function when(post: BlogPost): string {
  if (post.published && post.published_at) {
    return `Published ${format(new Date(post.published_at), "d MMM yyyy")}`;
  }
  const edited = post.updated_at ?? post.created_at;
  return edited
    ? `Edited ${formatDistanceToNow(new Date(edited), { addSuffix: true })}`
    : "Not saved yet";
}

/**
 * The draft you were last working on, first — because opening the blog
 * module is most often a way back to it. A slim banner, not a hero card
 *: the list under it is the page.
 */
export function ContinueWriting({
  post,
  onOpen,
}: {
  post: BlogPost;
  onOpen: () => void;
}) {
  const minutes = post.word_count
    ? readTimeFromWordCount(post.word_count)
    : null;

  return (
    <section
      aria-label="Continue writing"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-surface border border-primary/30 bg-accent/40 px-4 py-3"
    >
      <PenLine aria-hidden className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Continue writing</p>
        <p className="truncate font-medium">{post.title || "Untitled"}</p>
        <p className="text-xs text-muted-foreground">
          {when(post)}
          {post.word_count
            ? ` · ${post.word_count.toLocaleString()} words`
            : ""}
          {minutes ? ` · ${minutes} min read` : ""}
        </p>
      </div>
      <Button size="sm" onClick={onOpen}>
        Continue
      </Button>
    </section>
  );
}

/** Drafts and published posts are different kinds of work, so they are listed apart. */
export function PostSection({
  title,
  posts,
  ...actions
}: { title: string; posts: BlogPost[] } & PostActions) {
  if (posts.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
        {/* The space is for the accessible name — "Drafts 3", not "Drafts3". */}
        {title}{" "}
        <span className="font-normal tabular-nums text-muted-foreground">
          {posts.length}
        </span>
      </h2>
      {/* One ruled list, not a card per post. */}
      <ul className="list-none divide-y rounded-surface border bg-card p-0">
        {posts.map((post) => (
          <PostRow key={post.id} post={post} {...actions} />
        ))}
      </ul>
    </section>
  );
}

/** Its state in words, beside the title: the section heading was the only cue. */
export function PostStatusBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge
      variant="outline"
      className="h-6 shrink-0 gap-1 border-success/30 bg-success/10 px-2 text-micro text-success"
    >
      <Globe aria-hidden className="size-3" />
      Published
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="h-6 shrink-0 gap-1 px-2 text-micro text-muted-foreground"
    >
      <PenLine aria-hidden className="size-3" />
      Draft
    </Badge>
  );
}

/**
 * One post: its cover, title, state, summary and when — and, for a
 * published post, how many people have read it, in its own column so the
 * numbers line up.
 */
export function PostRow({
  post,
  onEdit,
  onToggleStatus,
  onDelete,
}: { post: BlogPost } & PostActions) {
  const cover = safeImageUrl(post.cover_image_url);
  const minutes = post.word_count
    ? readTimeFromWordCount(post.word_count)
    : null;
  const title = post.title || "Untitled";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        new URL(livePath(post), window.location.origin).toString(),
      );
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <li className="flex items-center gap-2 p-2 transition-colors hover:bg-secondary/40 sm:gap-4 sm:p-3">
      <button
        type="button"
        onClick={() => onEdit(post)}
        aria-label={`Edit ${title}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-control text-left focus-ring sm:gap-4"
      >
        <span className="flex aspect-[16/10] w-16 shrink-0 items-center justify-center overflow-hidden rounded-control bg-secondary sm:w-20">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <FileText className="size-5 text-muted-foreground" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-foreground">
              {title}
            </span>
            <PostStatusBadge published={!!post.published} />
          </span>
          {post.excerpt && (
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              {post.excerpt}
            </span>
          )}
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{when(post)}</span>
            {minutes && <span>{minutes} min read</span>}
            {post.published && typeof post.views === "number" && (
              <span className="tabular-nums sm:hidden">
                {post.views.toLocaleString()} views
              </span>
            )}
            {post.tags?.slice(0, 2).map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </span>
        </span>
      </button>

      {post.published && typeof post.views === "number" && (
        <span className="hidden w-20 shrink-0 text-right sm:block">
          <span className="block text-sm font-semibold tabular-nums text-foreground">
            {post.views.toLocaleString()}
          </span>
          <span className="block text-xs text-muted-foreground">views</span>
        </span>
      )}

      {/* Publish is on the row at every width; on a phone it was only in the
          menu. An icon there, with its name spoken. */}
      <Button
        size="sm"
        variant={post.published ? "ghost" : "outline"}
        onClick={() => onToggleStatus(post)}
        aria-label={post.published ? `Unpublish ${title}` : `Publish ${title}`}
        className="shrink-0"
      >
        {post.published ? (
          <EyeOff className="size-3.5 sm:mr-1.5" aria-hidden />
        ) : (
          <Send className="size-3.5 sm:mr-1.5" aria-hidden />
        )}
        <span className="hidden sm:inline">
          {post.published ? "Unpublish" : "Publish"}
        </span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`More actions for ${title}`}
            className="size-8 shrink-0"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => onEdit(post)}>
            <PenLine className="mr-2 size-4" aria-hidden /> Edit
          </DropdownMenuItem>
          {post.published && (
            <>
              <DropdownMenuItem asChild>
                <a
                  href={livePath(post)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 size-4" aria-hidden /> View live
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyLink()}>
                <Copy className="mr-2 size-4" aria-hidden /> Copy link
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDelete(post)}
          >
            <Trash2 className="mr-2 size-4" aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
