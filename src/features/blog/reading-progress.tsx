"use client";

import { useEffect, useState } from "react";

/**
 * Progress through the article, shown as a bar under the sticky header.
 *
 * Two things were wrong with measuring `document.documentElement.scrollHeight`:
 *
 * 1. It measured the whole document, so the header, breadcrumb, footer and
 *    share row all counted as "article". The bar reached 100% well after the
 *    post had ended, and started above 0% on a short post.
 *
 * 2. It was computed once on mount and then only on scroll. The markdown
 *    pipeline is code-split and lands *after* mount, so the initial reading was
 *    taken against a page that did not yet contain the post — and if the reader
 *    never scrolled, it was never corrected. A ResizeObserver recomputes when
 *    the article's height actually changes, which covers the chunk arriving and
 *    images resolving.
 */
export function ReadingProgress({
  targetId = "post-article",
}: {
  targetId?: string;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const article = document.getElementById(targetId);
    if (!article) return;

    const update = () => {
      const rect = article.getBoundingClientRect();
      const viewport = window.innerHeight;

      /**
       * How far the article's top has travelled above the viewport, over the
       * distance it needs to travel to be finished.
       *
       * For an article taller than the viewport that distance is the part that
       * has to be scrolled through. For one that fits on screen there is no
       * such distance, so the article's own height is used instead and the bar
       * fills as it scrolls away — treating a short article as fully read the
       * moment it appears would be wrong, since the reader has not read it yet.
       */
      const scrollable = rect.height - viewport;
      const distance = scrollable > 0 ? scrollable : rect.height;
      if (distance <= 0) {
        setProgress(0);
        return;
      }

      setProgress(Math.min(Math.max(-rect.top / distance, 0), 1));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    // The article grows when the split markdown chunk renders into it.
    const resize = new ResizeObserver(update);
    resize.observe(article);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resize.disconnect();
    };
  }, [targetId]);

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="fixed inset-x-0 top-0 z-chrome h-0.5 bg-transparent"
    >
      <div
        className="h-full origin-left bg-primary transition-transform duration-75 motion-reduce:transition-none"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
