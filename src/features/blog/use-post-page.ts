"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { toast } from "sonner";
import {
  useGetBlogPostBySlugQuery,
  useGetSiteIdentityQuery,
  useIncrementPostViewMutation,
} from "@/store/api/publicApi";
import { isSupabaseConfigured } from "@/lib/config";
import { useDisplayTimeZone } from "@/hooks/use-hydrated";
import { contentHash } from "./content-hash";
import { loadPostContent } from "./post-content-loader";
import { useHeadings } from "./table-of-contents";

const VIEW_COUNT_DELAY_MS = 5000;

/** The article element's id: the table of contents reads its headings. */
export const ARTICLE_ID = "post-article";

/**
 * The body as rendered at build time, and a fingerprint of the markdown it
 * was rendered from. While the fetched post's body matches, the page
 * shows that HTML and never downloads the markdown pipeline.
 */
export interface PrerenderedBody {
  contentHash: string;
  body: ReactNode;
}

/**
 * What a post page does, apart from how it looks: the post, the view count,
 * whether the build's body is still current, the headings, sharing. The
 * Classic page and the immersive one both call this.
 */
export function usePostPage(slug: string, prerendered?: PrerenderedBody) {
  const {
    data: post,
    isLoading,
    isError,
  } = useGetBlogPostBySlugQuery(slug || skipToken);
  const { data: identity } = useGetSiteIdentityQuery();
  const [incrementView] = useIncrementPostViewMutation();
  const [copied, setCopied] = useState(false);
  // Prerendered: UTC until hydrated, so the build and the browser agree.
  const timeZone = useDisplayTimeZone();

  // Owned by the page, not the rail: the layout has to know whether a table of
  // contents will render before it decides how wide the article is.
  const { headings, activeId } = useHeadings(ARTICLE_ID);

  // Warm the markdown chunk alongside the post query, when it will be needed:
  // no build-time body (/blog/view), or the post has changed since the build.
  const builtIsCurrent =
    !!prerendered &&
    !!post &&
    contentHash(post.content ?? "") === prerendered.contentHash;
  const needsPipeline = !prerendered || (!!post && !builtIsCurrent);
  useEffect(() => {
    if (needsPipeline) void loadPostContent();
  }, [needsPipeline]);

  // Static-export limitation: the document title is set client-side.
  useEffect(() => {
    if (post) document.title = post.title;
  }, [post]);

  // A view counts once the reader has stayed, in production, and not for an
  // automated browser.
  //
  // Keyed on the post's id, and remembered: counting a view invalidates the
  // post, which comes back as a new object with views + 1. Depending on that
  // object restarted the timer every time, so a reader who stayed a minute
  // was counted about a dozen times.
  const countedId = useRef<string | null>(null);
  const postId = post?.id;
  useEffect(() => {
    if (
      !postId ||
      process.env.NODE_ENV !== "production" ||
      !isSupabaseConfigured
    )
      return;
    if (navigator.webdriver) return;
    if (countedId.current === postId) return;
    const timer = setTimeout(() => {
      countedId.current = postId;
      incrementView(postId);
    }, VIEW_COUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [postId, incrementView]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const published = post?.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone,
      })
    : "";
  const hasToc = !!post && post.show_toc !== false && headings.length > 0;
  const tags = (post?.tags ?? []).filter((tag) => tag.trim());

  const share = (network: "x" | "linkedin") => {
    if (!post) return;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(post.title);
    window.open(
      network === "x"
        ? `https://twitter.com/intent/tweet?url=${url}&text=${text}`
        : `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return {
    post,
    isLoading,
    isError,
    identity,
    headings,
    activeId,
    builtIsCurrent,
    hasToc,
    tags,
    published,
    copied,
    share,
    copyLink,
  };
}
