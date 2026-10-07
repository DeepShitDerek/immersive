/**
 * Where a post lives.
 *
 * Posts that existed at the last build have a prerendered page at
 * /blog/<slug>/, with their own title and link preview. A post published since
 * then has no file yet, so it is served by the client-rendered /blog/view/
 * route until the next build. `builtSlugs` is the build's list, handed down by
 * the server component; without it every post uses the fallback.
 */
export function postHref(slug: string, builtSlugs?: readonly string[]): string {
  const encoded = encodeURIComponent(slug);
  return builtSlugs?.includes(slug)
    ? `/blog/${encoded}/`
    : `/blog/view/?slug=${encoded}`;
}
