import { RichMarkdown } from "@/components/ui/rich-markdown";

/**
 * A published post's body. No directive, so it renders on the server: the
 * post route renders it at build time, and `post-content.tsx` makes
 * it a client component for posts that need rendering in the browser.
 *
 * The pipeline itself now lives in `components/ui/rich-markdown` so notes can
 * share it — a note is written in the same editor and had no reason to render
 * code fences without highlighting. What stays here is the part that is
 * specific to a post: every link is external, so every link opens a new tab.
 */
export function PostBody({ content }: { content: string }) {
  return (
    // `max-w-none` was here to escape the 65ch cap that `<article>` used to
    // inherit. With the cap now scoped to prose itself, the measure is the
    // point: overriding it would set the body to the full column width, which
    // is well past a readable line length in the table-of-contents layout.
    <RichMarkdown
      // Left-aligned in its column: centring it there was one of the post's
      // three left edges.
      className="post-prose [&>*:first-child]:mt-0"
      components={{
        a: ({ href, children, ...props }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        ),
      }}
    >
      {content}
    </RichMarkdown>
  );
}
