"use client";

/**
 * The post body as a client component: for /blog/view (posts published since
 * the build) and for a post edited since the build. A prerendered, unchanged
 * post uses the body rendered at build time instead (post-page.tsx).
 */
export { PostBody as PostContent } from "./post-body";
