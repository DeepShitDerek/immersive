import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * The single renderer for short-form markdown — hero tagline, about bio, life
 * updates, footer, CMS section blurbs.
 *
 * Every one of those call sites used to instantiate ReactMarkdown itself, and
 * they disagreed about plugins: some passed `remarkGfm`, most passed nothing.
 * The result was that the same body of text (all of it authored in the same
 * editor) rendered tables, strikethrough and task lists on one page and printed
 * them as literal pipes and tildes on the next.
 *
 * Blog posts deliberately do NOT go through here — they need raw-HTML
 * passthrough, sanitization and syntax highlighting, and `features/blog/
 * post-content` keeps that pipeline so `rehype-prism-plus` stays out of the
 * chunk for every other public page.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
