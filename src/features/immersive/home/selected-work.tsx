"use client";

import { useRef, type FocusEvent } from "react";
import Link from "next/link";
import type { PortfolioItem } from "@/types";
import { useBuiltCaseStudySlugs } from "@/store/public-preload";
import { caseStudyHref } from "@/features/work/case-study-href";
import { stackLine } from "@/features/home/featured-work";
import { ItemImage } from "@/features/sections/shared";
import { isInternalUrl, safeImageUrl, safeLinkUrl } from "@/lib/safe-url";
import { plainPreview } from "@/lib/text-preview";
import { ProjectPattern } from "../pattern/project-pattern";
import { IMAGE_SCRIM } from "../styles";
import { useScene, type Scene } from "../motion/scroll-provider";

const two = (n: number) => String(n).padStart(2, "0");

const ACTION =
  "im-mono inline-flex min-h-6 items-center rounded-control text-foreground underline decoration-primary underline-offset-4 focus-ring";

/** As the next panel rises, the one under it settles back. Pinned screens only. */
function workScene({ gsap, el, pin }: Scene) {
  if (!pin) return;
  const panels = [...el.querySelectorAll<HTMLElement>("[data-panel]")];
  panels.slice(0, -1).forEach((panel, index) => {
    gsap.to(panel.querySelector("[data-panel-body]"), {
      scale: 0.94,
      opacity: 0.35,
      ease: "none",
      scrollTrigger: {
        trigger: panels[index + 1],
        start: "top bottom",
        end: "top top",
        scrub: true,
      },
    });
  });
}

/**
 * Brings a pinned panel fully into view when the keyboard reaches a link in
 * it. A sticky panel counts as "in view" to the browser for its whole pinned
 * stretch, so on its own the browser can leave the focused link under the
 * next panel. This scrolls to the point where the panel has just taken the
 * screen and the next one has not started to cover it.
 */
function revealPanel(event: FocusEvent<HTMLLIElement>) {
  const panel = event.currentTarget;
  if (!event.target.matches(":focus-visible")) return;
  const style = getComputedStyle(panel);
  const list = panel.parentElement;
  if (style.position !== "sticky" || !list) return;
  const index = Array.prototype.indexOf.call(list.children, panel);
  const listTop = list.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({
    top: listTop + index * panel.offsetHeight - parseFloat(style.top),
    behavior: "instant",
  });
}

/**
 * Beat 4: each featured project takes the screen in turn.
 *
 * Every panel is `position: sticky` (`.im-pin`), so a later panel slides over
 * the one before it with no script. On a phone or with reduced motion they are
 * ordinary sections, one under another. Keyboard order is document order.
 */
export function SelectedWork({ items }: { items: readonly PortfolioItem[] }) {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, workScene);
  const built = useBuiltCaseStudySlugs();

  return (
    <section ref={ref} data-beat="work" aria-labelledby="im-work-heading">
      <h2 id="im-work-heading" className="sr-only">
        Selected work
      </h2>
      <ol>
        {items.map((item, index) => {
          const image = safeImageUrl(item.image_url);
          const summary = item.description
            ? plainPreview(item.description)
            : "";
          const stack = stackLine(item.tags);
          const caseStudy = Boolean(item.has_case_study && item.slug);
          const link = safeLinkUrl(item.link_url);
          return (
            <li
              key={item.id}
              data-panel
              onFocus={revealPanel}
              className="im-pin im-pin-panel im-rule relative overflow-hidden bg-background"
            >
              <div
                data-panel-body
                className="relative flex h-full min-h-[70svh] flex-col justify-between gap-10 px-[var(--band-x)] py-10 max-[399px]:px-4"
              >
                {image ? (
                  <>
                    <ItemImage
                      src={item.image_url}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                    {/* The scrim keeps text at AA over any image: IMAGE_SCRIM. */}
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-background"
                      style={{ opacity: IMAGE_SCRIM }}
                    />
                  </>
                ) : (
                  <ProjectPattern
                    title={item.title}
                    tags={item.tags}
                    className="absolute inset-0 size-full text-border"
                  />
                )}
                <p className="im-mono relative flex justify-between gap-4">
                  <span>Selected work</span>
                  <span>
                    {two(index + 1)} / {two(items.length)}
                  </span>
                </p>
                <div className="relative min-w-0">
                  <h3 className="im-display im-display-lg im-clamp">
                    {item.title}
                  </h3>
                  {summary && (
                    <p className="im-clamp mt-5 max-w-prose text-base leading-relaxed text-muted-foreground">
                      {summary}
                    </p>
                  )}
                </div>
                <p className="relative flex min-h-6 flex-wrap items-center justify-between gap-x-8 gap-y-3">
                  <span className="im-mono">{stack}</span>
                  {caseStudy ? (
                    <Link
                      href={caseStudyHref(item.slug!, built)}
                      className={ACTION}
                    >
                      Read case study
                      <span className="sr-only">: {item.title}</span>
                    </Link>
                  ) : (
                    link && (
                      <a
                        href={link}
                        className={ACTION}
                        {...(isInternalUrl(link)
                          ? {}
                          : { target: "_blank", rel: "noopener noreferrer" })}
                      >
                        View the project
                        <span className="sr-only">: {item.title}</span>
                      </a>
                    )
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
