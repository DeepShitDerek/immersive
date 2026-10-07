import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypePrism from "rehype-prism-plus";
import rehypeSlug from "rehype-slug";

import { cn } from "@/lib/cn";

/**
 * Long-form markdown: raw HTML, sanitization, syntax highlighting, heading ids.
 *
 * Distinct from `Markdown`, which is the short-form renderer for taglines, bios
 * and CMS blurbs. That one deliberately omits this pipeline so `rehype-prism-plus`
 * stays out of every public page's chunk — but anything a person actually
 * *writes* in the editor needs it, and a note whose code fences rendered as
 * grey blocks with no highlighting was the symptom of using the wrong one.
 *
 * Pipeline order is load-bearing: raw HTML passthrough → sanitize (extended to
 * keep GFM task-list checkboxes) → Prism highlighting → slug heading ids, so
 * Prism classes and heading ids survive sanitization.
 *
 * No "use client": it has no state, so it renders on the server too. A
 * prerendered blog post's body is rendered here at build time and its
 * visitors never download the pipeline. Imported from a client
 * module (notes, the /blog/view fallback) it is client code as before, still
 * only behind `next/dynamic` boundaries or on admin routes.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "input"],
  attributes: {
    ...defaultSchema.attributes,
    input: ["type", "checked", "disabled"],
    // Prism writes language and token classes onto code elements; without
    // these on the allowlist the highlighting is stripped after it is applied.
    code: [...(defaultSchema.attributes?.code || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className"],
    pre: [...(defaultSchema.attributes?.pre || []), "className"],
    div: [...(defaultSchema.attributes?.div || []), "className"],
  },
};

export interface RichMarkdownProps {
  children: string;
  className?: string;
  /** Link behaviour differs per surface — a blog post opens a new tab, an
      in-app note navigates. The pipeline is shared; the destination is not. */
  components?: Components;
}

export function RichMarkdown({
  children,
  className,
  components,
}: RichMarkdownProps) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          rehypePrism,
          rehypeSlug,
        ]}
        components={{
          // A long line scrolls the block sideways; the tab stop is what lets
          // a keyboard scroll it (WCAG 2.1.1).
          pre: ({ node: _node, ...props }) => <pre tabIndex={0} {...props} />,
          ...components,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
