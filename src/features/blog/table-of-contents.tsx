"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * The line the reader's attention sits on, in pixels from the top of the
 * viewport.
 *
 * One constant for two jobs, and that is the entire fix for the reported bug.
 * Clicking an entry scrolls the heading to this line; the active entry is the
 * last heading to have crossed it. When those two numbers were different, a
 * click could not possibly highlight what it navigated to — see below.
 */
const SCROLL_OFFSET = 96;

/** Treat "within a pixel of the bottom" as the bottom; scroll heights are fractional. */
const BOTTOM_EPSILON = 2;

/**
 * The active entry, given where each heading currently sits in the viewport.
 *
 * **What this replaces.** The active heading came from an
 * `IntersectionObserver` with `rootMargin: "-20% 0px -70% 0px"` that set the
 * active id only `if (entry.isIntersecting)` — that is, only while a heading
 * was inside a band 20%–30% of the way down the viewport. Three failures came
 * out of that, and the owner reported two of them:
 *
 *  1. **Clicking an entry could never highlight it.** The click parks the
 *     heading 96px from the top. On a 900px window the band starts at 180px.
 *     The heading lands *above* the band, never intersects, and the highlight
 *     stays wherever it was. This is why the page scrolled to the right place
 *     and the wrong entry stayed lit.
 *  2. **The last heading was often unreachable.** At the end of the document
 *     there may be no scroll left to bring a short final section up into the
 *     band, so its entry never lit at all.
 *  3. **Several entries in one callback resolved by array order.** The last
 *     one in the array won regardless of which was actually on screen, so a
 *     fast scroll could leave a lower heading active than the one being read.
 *
 * Asking "which heading did I last pass" instead has none of those states: it
 * is defined for every scroll position, it uses the same line the click does,
 * and exactly one entry is always active.
 *
 * `tops` are viewport-relative (`getBoundingClientRect().top`).
 */
function activeHeadingFromTops(
  tops: { id: string; top: number }[],
  offset: number,
  atBottom: boolean,
): string {
  if (tops.length === 0) return "";

  // At the bottom of the document the final sections may all sit below the
  // line, and no amount of further scrolling will change that. The last
  // heading is what the reader is on.
  if (atBottom) return tops[tops.length - 1].id;

  let active = tops[0].id;
  for (const heading of tops) {
    if (heading.top - offset <= 1) active = heading.id;
    else break;
  }
  return active;
}

/**
 * Extracts h2/h3 from the rendered article and tracks the active heading.
 *
 * The scan cannot be a one-shot on mount, because on /blog/view two separate
 * things arrive after this effect first runs:
 *
 *  1. **The article itself.** The post is fetched client-side, so the page
 *     renders a skeleton and `<article id>` does not exist yet.
 *  2. **Its content.** The markdown pipeline (raw → sanitize → prism → slug)
 *     is code-split, so the body lands later still.
 *
 * `containerId` never changes, so the effect never re-runs on its own — a scan
 * that gives up on either miss produces no table of contents at all. Both are
 * watched: one observer waits for the article to appear, then hands over to a
 * second that re-scans as its subtree fills in.
 */
export function useHeadings(containerId: string) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    let contentWatcher: MutationObserver | null = null;
    let arrivalWatcher: MutationObserver | null = null;
    let tracked: HTMLElement[] = [];
    let frame = 0;

    /**
     * Recomputed on scroll rather than pushed by an observer.
     *
     * One `getBoundingClientRect` per heading, once per animation frame, is a
     * single batched layout read — and it is the only way to get an answer
     * that is correct at *every* scroll position rather than only while a
     * heading happens to be inside an observer's band.
     */
    const update = () => {
      frame = 0;
      if (tracked.length === 0) return;

      const scrollBottom = window.scrollY + window.innerHeight;
      const atBottom =
        scrollBottom >= document.documentElement.scrollHeight - BOTTOM_EPSILON;

      setActiveId(
        activeHeadingFromTops(
          tracked.map((el) => ({
            id: el.id,
            top: el.getBoundingClientRect().top,
          })),
          SCROLL_OFFSET,
          atBottom,
        ),
      );
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const scan = (container: HTMLElement) => {
      const elements = Array.from(
        container.querySelectorAll<HTMLElement>("h2[id], h3[id]"),
      );
      tracked = elements;
      // Late-arriving content moves every heading below it, so the answer has
      // to be recomputed when the article fills in — not only when the reader
      // scrolls. Called directly rather than through the frame throttle: this
      // is the first answer, and waiting a frame for it means the rail renders
      // once with nothing highlighted.
      update();

      setHeadings((previous) => {
        // Bail when nothing changed: a fresh array on every mutation would
        // re-render the article's siblings continuously while the chunk or an
        // image is still settling.
        const same =
          previous.length === elements.length &&
          previous.every((h, i) => h.id === elements[i].id);
        return same
          ? previous
          : elements.map((el) => ({
              id: el.id,
              text: el.textContent ?? "",
              level: el.tagName === "H2" ? 2 : 3,
            }));
      });
    };

    const attach = (container: HTMLElement) => {
      scan(container);
      contentWatcher = new MutationObserver(() => scan(container));
      contentWatcher.observe(container, { childList: true, subtree: true });
    };

    const existing = document.getElementById(containerId);
    if (existing) {
      attach(existing);
    } else {
      /**
       * The container itself arrives late.
       *
       * The post is fetched client-side, so the page renders a skeleton first
       * and `<article id>` does not exist yet when this effect runs. Bailing
       * out here — which is what the first version did — meant the scan never
       * happened at all, because `containerId` never changes and the effect
       * never re-runs. Watching for the article to appear is what makes the
       * table of contents show up reliably rather than only when the markdown
       * chunk and the query both happened to resolve before mount.
       */
      arrivalWatcher = new MutationObserver(() => {
        const container = document.getElementById(containerId);
        if (!container) return;
        arrivalWatcher?.disconnect();
        arrivalWatcher = null;
        attach(container);
      });
      arrivalWatcher.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      arrivalWatcher?.disconnect();
      contentWatcher?.disconnect();
    };
  }, [containerId]);

  return { headings, activeId };
}

function scrollToHeading(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET,
    behavior: "smooth",
  });
}

/**
 * The `scrollTop` that brings an entry into view, or null when it already is.
 *
 * Deliberately not `scrollIntoView({ block: "nearest" })`: that walks up to
 * whichever ancestor happens to be scrollable, so on a short list — where the
 * rail does not scroll — it moves the *page* instead, yanking the reader away
 * from the paragraph they were on.
 */
function scrollTopForEntry(view: {
  scrollTop: number;
  clientHeight: number;
  entryTop: number;
  entryHeight: number;
}): number | null {
  const { scrollTop, clientHeight, entryTop, entryHeight } = view;
  if (clientHeight <= 0) return null;

  if (entryTop < scrollTop) return entryTop;

  const entryBottom = entryTop + entryHeight;
  if (entryBottom > scrollTop + clientHeight) return entryBottom - clientHeight;

  return null;
}

function TocList({
  headings,
  activeId,
  onNavigate,
  scrollRef,
}: {
  headings: Heading[];
  activeId: string;
  onNavigate?: () => void;
  /** The scrolling ancestor, when the list lives in one. */
  scrollRef?: RefObject<HTMLElement | null>;
}) {
  /**
   * Keep the active entry visible inside the rail.
   *
   * On a long post the rail scrolls independently of the page, so the
   * highlighted entry drifts out of its own viewport as the reader moves down
   * the article — the highlight is then invisible, which is worse than not
   * having one.
   */
  useEffect(() => {
    const container = scrollRef?.current;
    if (!container || !activeId) return;

    const entry = container.querySelector<HTMLElement>(
      `[data-heading="${CSS.escape(activeId)}"]`,
    );
    if (!entry) return;

    const next = scrollTopForEntry({
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
      entryTop: entry.offsetTop,
      entryHeight: entry.offsetHeight,
    });
    if (next !== null) container.scrollTop = next;
  }, [activeId, scrollRef]);

  return (
    <ul className="space-y-0.5 border-l-2 border-border">
      {headings.map((heading) => (
        <li key={heading.id}>
          <button
            type="button"
            data-heading={heading.id}
            onClick={() => {
              scrollToHeading(heading.id);
              onNavigate?.();
            }}
            aria-current={activeId === heading.id ? "location" : undefined}
            className={cn(
              "-ml-0.5 block w-full border-l-2 py-1 text-left text-sm transition-colors",
              heading.level === 3 ? "pl-7" : "pl-4",
              activeId === heading.id
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {heading.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The contents of a post, in the margin rail on a wide screen. Renders
 * nothing without headings; the page decides whether the rail exists, so it
 * never reserves a column for a list that is empty.
 */
export function TableOfContents({
  headings,
  activeId,
}: {
  headings: Heading[];
  activeId: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  if (headings.length === 0) return null;

  return (
    // h-full: the sticky list can only travel inside this nav, so the nav
    // has to be as tall as the article. Sized to its own list, it gave the
    // list nowhere to stick, and it scrolled away with the page.
    <nav aria-label="Table of contents" className="hidden h-full lg:block">
      {/*
        `sticky` alone was the bug. With no height bound the rail extended
        past the bottom of the viewport and stayed pinned there, so on a long
        post the last entries were unreachable — scrolling the page moved the
        article, never the rail.

        `flex` + `min-h-0` is what lets the list shrink inside the bounded
        column; without it the list keeps its intrinsic height and overflows
        again. `overscroll-contain` stops a flick at the end of the rail from
        chaining into the page.
      */}
      <div className="sticky top-24 flex max-h-[calc(100dvh-8rem)] flex-col">
        <p className="t-eyebrow mb-4 shrink-0">On this page</p>
        <div
          ref={railRef}
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <TocList
            headings={headings}
            activeId={activeId}
            scrollRef={railRef}
          />
        </div>
      </div>
    </nav>
  );
}

/**
 * The same contents on a phone, as a closed disclosure at the head of the
 * post. It was a floating "On this page" button pinned over the
 * bottom-right of the text, covering a line of every screen; here it costs
 * one row and opens in place. Choosing an entry closes it.
 */
export function TableOfContentsInline({
  headings,
  activeId,
}: {
  headings: Heading[];
  activeId: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  if (headings.length === 0) return null;

  return (
    <details ref={ref} className="group mt-8 border-y border-border lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-control py-3 text-sm font-medium focus-ring [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <List className="size-4 text-muted-foreground" aria-hidden />
          On this page
          <span className="font-mono text-micro text-muted-foreground">
            {headings.length}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 text-muted-foreground transition-transform duration-fast group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <nav aria-label="Table of contents" className="pb-4">
        <TocList
          headings={headings}
          activeId={activeId}
          onNavigate={() => ref.current?.removeAttribute("open")}
        />
      </nav>
    </details>
  );
}
