"use client";

import { PublishSiteButton } from "@/components/admin/publish-site-button";
import { useUrlParam } from "@/hooks/use-url-param";
import { useCreateIntent } from "@/features/admin-shell/create-intent";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FileText, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { BlogPost } from "@/types";
import {
  useDeleteBlogPostMutation,
  useGetAdminBlogPostsQuery,
  useUpdateBlogPostMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import {
  EmptyState,
  LoadingState,
  ManagerWrapper,
  ModuleTabs,
  PageHeader,
  LoadError,
} from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import {
  draftFromPost,
  postProblems,
  PUBLISHED_UNTIL_DEPLOY,
  recordFromDraft,
} from "./post-draft";
import { ContinueWriting, PostSection } from "./post-list";

// The editor pulls in TipTap — loaded only when a post is opened, so the list
// stays light.
const BlogEditor = dynamic(() => import("./blog-editor"), {
  ssr: false,
  loading: () => <LoadingState label="Opening the editor" />,
});

type Status = "all" | "draft" | "published";

const time = (iso?: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);

/**
 * The blog: what you are writing, then what is out and how it is doing.
 *
 * The latest draft leads as "Continue writing", because coming back to it is
 * the usual reason to open this page. Drafts and published posts are listed
 * apart — one is work in progress, the other is a record with readers — and a
 * published row carries its views in a column of its own.
 */
/** One empty list for every render while the query has none (see Navigation). */
const NO_POSTS: BlogPost[] = [];

export default function BlogAdminPage() {
  const {
    data: allPosts = NO_POSTS,
    isLoading,
    error: loadError,
    refetch,
  } = useGetAdminBlogPostsQuery();
  const [updateBlogPost] = useUpdateBlogPostMutation();
  const [deleteBlogPost] = useDeleteBlogPostMutation();
  // Delete offers Undo instead of asking first: a published post
  // stays on the blog until the toast closes.
  const { pending: deleting, remove: removePost } = useUndoableDelete<BlogPost>(
    async (post) => {
      try {
        await deleteBlogPost(post).unwrap();
      } catch (err) {
        toast.error("Couldn't delete the post", {
          description: getErrorMessage(err),
        });
      }
    },
  );
  const posts = useMemo(
    () =>
      deleting.size ? allPosts.filter((p) => !deleting.has(p.id)) : allPosts,
    [allPosts, deleting],
  );

  /**
   * The open editor. Keyed once when opened, not by post id, so a new post's
   * first save — which gives it an id — does not remount the editor under
   * the person typing in it.
   */
  const [session, setSession] = useState<{
    key: number;
    id: string | null;
  } | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");

  // The open post lives in the URL, "new" for one not yet saved.
  const [postParam, setPostParam] = useUrlParam("post", "replace");
  const open = (post: BlogPost | null) => {
    setSession({ key: Date.now(), id: post?.id ?? null });
    setPostParam(post?.id ?? "new");
  };
  const close = () => {
    setSession(null);
    setPostParam(null);
  };
  useEffect(() => {
    if (session || !postParam) return;
    if (postParam === "new") setSession({ key: Date.now(), id: null });
    else if (posts.some((p) => p.id === postParam))
      setSession({ key: Date.now(), id: postParam });
    // Once the posts have loaded; after that `session` is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postParam, posts]);
  useCreateIntent("post", () => open(null));

  const handleDelete = (post: BlogPost) => {
    if (session?.id === post.id) close();
    removePost(
      post,
      `Deleted "${post.title || "Untitled"}"`,
      post.published
        ? "It comes off the blog, with its views, when this closes."
        : undefined,
    );
  };

  /** Publishing from the list follows the editor's rules: a post needs a body. */
  const handleToggle = async (post: BlogPost) => {
    const publishing = !post.published;
    if (publishing) {
      const problems = postProblems(
        recordFromDraft(draftFromPost(post), true, post),
        true,
      );
      if (Object.keys(problems).length > 0) {
        toast.error("Not ready to publish", {
          description: `${Object.values(problems)[0]} Open the post to finish it.`,
        });
        return;
      }
    }
    try {
      await updateBlogPost({
        id: post.id,
        published: publishing,
        published_at: publishing ? new Date().toISOString() : null,
      }).unwrap();
      toast.success(
        publishing ? "Published." : "Moved back to drafts.",
        publishing ? { description: PUBLISHED_UNTIL_DEPLOY } : undefined,
      );
    } catch (err) {
      toast.error("Couldn't update the post", {
        description: getErrorMessage(err),
      });
    }
  };

  const term = search.trim().toLowerCase();
  const matching = useMemo(
    () =>
      posts.filter(
        (post) =>
          !term ||
          [post.title, post.excerpt, ...(post.tags ?? [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term),
      ),
    [posts, term],
  );

  if (session) {
    const post = session.id
      ? (posts.find((p) => p.id === session.id) ?? null)
      : null;
    return (
      <BlogEditor
        key={session.key}
        post={post}
        onClose={close}
        onCreated={(created) => {
          setSession((s) => (s ? { ...s, id: created.id } : s));
          setPostParam(created.id);
        }}
        onDelete={handleDelete}
      />
    );
  }

  const drafts = matching
    .filter((p) => !p.published)
    .sort(
      (a, b) =>
        time(b.updated_at ?? b.created_at) - time(a.updated_at ?? a.created_at),
    );
  const live = matching
    .filter((p) => p.published)
    .sort((a, b) => time(b.published_at) - time(a.published_at));
  const counts = {
    all: posts.length,
    draft: posts.filter((p) => !p.published).length,
    published: posts.filter((p) => p.published).length,
  };
  const featured = status === "all" && !term ? drafts[0] : undefined;
  const draftRows = featured ? drafts.slice(1) : drafts;
  const showDrafts = status !== "published";
  const showLive = status !== "draft";
  const nothing =
    !featured &&
    (!showDrafts || draftRows.length === 0) &&
    (!showLive || live.length === 0);

  const actions = {
    onEdit: open,
    onToggleStatus: handleToggle,
    onDelete: handleDelete,
  };

  return (
    <ManagerWrapper>
      <PageHeader
        title="Blog"
        description="What you're writing, and how published posts are doing. New posts are live at once; their own page and link preview arrive with the next deploy."
        actions={
          <Button onClick={() => open(null)}>
            <Plus className="mr-2 size-4" aria-hidden /> New post
          </Button>
        }
      />

      <div className="mb-4">
        <PublishSiteButton />
      </div>

      {isLoading ? (
        <LoadingState label="Loading posts" />
      ) : loadError && posts.length === 0 ? (
        <LoadError what="your posts" error={loadError} onRetry={refetch} />
      ) : posts.length === 0 ? (
        <EmptyState
          variant="card"
          icon={FileText}
          title="No posts yet"
          description="Write your first post — it stays a draft until you publish it."
          action={{ label: "New post", onClick: () => open(null), icon: Plus }}
        />
      ) : (
        <div className="space-y-8">
          {featured && (
            <ContinueWriting post={featured} onOpen={() => open(featured)} />
          )}

          {/* Status as tabs with their counts, above one search row. */}
          <ModuleTabs
            label="Post status"
            className="mb-0"
            tabs={[
              { id: "all" as Status, label: `All ${counts.all}` },
              { id: "draft" as Status, label: `Drafts ${counts.draft}` },
              {
                id: "published" as Status,
                label: `Published ${counts.published}`,
              },
            ]}
            current={status}
            onSelect={setStatus}
          />
          <div className="flex items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search posts…"
                aria-label="Search posts"
                className="h-9 pl-8"
              />
            </div>
          </div>

          {nothing ? (
            <EmptyState
              variant="card"
              size="compact"
              icon={Search}
              title="No matches"
              description="No posts match this filter and search."
              action={{
                label: "Clear filters",
                onClick: () => {
                  setSearch("");
                  setStatus("all");
                },
              }}
            />
          ) : (
            <>
              {showDrafts && (
                <PostSection title="Drafts" posts={draftRows} {...actions} />
              )}
              {showLive && (
                <PostSection title="Published" posts={live} {...actions} />
              )}
            </>
          )}
        </div>
      )}
    </ManagerWrapper>
  );
}
