"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { ArrowUpRight, GitBranch, GitMerge } from "lucide-react";
import type { PortfolioItem } from "@/types";
import { safeImageUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import {
  buildTimeline,
  isOngoingWord,
  timelineDuration,
  trunkAlongside,
  type TimelineRow,
} from "./timeline-model";
import { ItemImage, ItemTags, Markdown, PlainText, TextLink } from "./shared";

/**
 * The timeline, as a sequence of chapters.
 *
 * ## The layout
 *
 * Three columns from `md` up: **when**, **the rail**, **what**. The period sits
 * in its own column, large, so the eye can run down the dates alone and read
 * the shape of a career before reading any of it — and it is sticky, so a long
 * description never scrolls its own date out of view. On a phone the period
 * folds into one line above the card and the rail moves to the edge; nothing
 * is dropped, only rearranged.
 *
 * The period is the author's own strings, never a reformatted parse: the
 * column is free text, and "Summer 2022" must read as written. What *is*
 * derived — the duration — is shown only when both ends can be read.
 *
 * ## What the rail says
 *
 * One line, filled in the theme's primary as the section scrolls past, so the
 * reader's position in the story is drawn on the story. Each node fills as it
 * arrives. Work with no end date pulses — the one moving thing at rest, and
 * the one thing still happening.
 *
 * Work that ran *alongside* other work (derived from overlapping dates) is set
 * in as a side track — a smaller, hollow node and an indented card — and names
 * what it ran alongside. A declared merge is said on the card.
 * Neither is drawn as a lane: lanes were accurate and hard to read, and had to
 * collapse on a phone regardless.
 *
 * ## Theme and motion
 *
 * Tokens only, so every preset — dark ones included — restyles it with no
 * special case. Nodes are hollow on a card fill rather than ringed in a "gap"
 * colour, because a band's fill is not something a node can know. Cards are
 * present from the first paint for everyone (they used to fade in on scroll,
 * and an observer that never fired left them invisible). Only the rail's
 * progress and the nodes' fill move, both transforms, and under reduced motion
 * neither does.
 */

/** The house curve — the same one as `--m-enter`. */
const EASE = [0.32, 0.72, 0, 1] as const;

/** Rail x-position: the centre of the rail column at each breakpoint. */
const RAIL_X = "left-[calc(0.75rem-1px)] md:left-[calc(11.75rem-1px)]";

function Period({
  item,
  duration,
  ongoing,
  compact,
}: {
  item: PortfolioItem;
  duration: string | null;
  ongoing: boolean;
  compact?: boolean;
}) {
  const from = item.date_from?.trim() || null;
  const to = item.date_to?.trim() || null;
  if (!from && !to) return null;

  const end = ongoing ? <NowTag /> : to;

  if (compact) {
    return (
      <p className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold [overflow-wrap:anywhere]">
          {from ?? `Until ${to}`}
        </span>
        {from && end && (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span aria-hidden>—</span>
            {end}
          </span>
        )}
        {duration && (
          <span className="text-muted-foreground">· {duration}</span>
        )}
      </p>
    );
  }

  return (
    <div className="text-right">
      <p className="font-heading text-2xl font-semibold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere]">
        {from ?? to}
      </p>
      {from && end && (
        <p className="mt-1.5 flex items-center justify-end gap-1.5 text-sm text-muted-foreground">
          {ongoing ? end : <>to {end}</>}
        </p>
      )}
      {!from && to && (
        <p className="mt-1.5 text-sm text-muted-foreground">until</p>
      )}
      {duration && (
        <p className="mt-1 text-xs text-muted-foreground">{duration}</p>
      )}
    </div>
  );
}

function NowTag() {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-primary">
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
        <span className="relative size-1.5 rounded-full bg-primary" />
      </span>
      Present
    </span>
  );
}

function Node({
  branch,
  ongoing,
  reduceMotion,
}: {
  branch: boolean;
  ongoing: boolean;
  reduceMotion: boolean;
}) {
  return (
    <span
      aria-hidden
      data-node={branch ? "branch" : "trunk"}
      data-ongoing={ongoing || undefined}
      className={cn(
        "relative z-raised block shrink-0 rounded-full border-2 border-primary bg-card",
        branch ? "mt-1.5 size-2.5 md:mt-[1.85rem]" : "mt-1 size-3.5 md:mt-7",
      )}
    >
      {ongoing && (
        <span className="absolute -inset-1.5 animate-ping rounded-full bg-primary/25 motion-reduce:hidden" />
      )}
      {!branch && (
        <motion.span
          className="absolute inset-0.5 rounded-full bg-primary"
          {...(reduceMotion
            ? {}
            : {
                initial: { scale: 0 },
                whileInView: { scale: 1 },
                viewport: { once: true, margin: "0px 0px -30% 0px" },
                transition: { duration: 0.4, ease: EASE },
              })}
        />
      )}
    </span>
  );
}

function Relation({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
      {icon}
      {children}
    </span>
  );
}

export function Timeline({ items }: { items: PortfolioItem[] }) {
  const graph = useMemo(() => buildTimeline(items), [items]);
  const reduceMotion = useReducedMotion() ?? false;

  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 80%", "end 55%"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    restDelta: 0.001,
  });

  // "Present" means the visitor's today, not the build's. Reading the clock
  // after mount keeps a statically exported page from hydrating a duration
  // computed on the day it was built.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  if (graph.rows.length === 0) return null;

  return (
    <div className="relative">
      {/* The track, fading out below the oldest entry. */}
      <span
        aria-hidden
        className={cn(
          "absolute bottom-0 top-2 w-0.5 rounded-full bg-gradient-to-b from-border from-85% to-transparent",
          RAIL_X,
        )}
      />
      {/* Progress: how far through the story the reader has scrolled. */}
      {!reduceMotion && (
        <motion.span
          aria-hidden
          data-rail-progress
          style={{ scaleY: progress }}
          className={cn(
            "absolute bottom-10 top-2 w-0.5 origin-top rounded-full bg-primary",
            RAIL_X,
          )}
        />
      )}

      <ol ref={listRef} className="relative space-y-10 md:space-y-14">
        {graph.rows.map((row: TimelineRow<PortfolioItem>, index) => {
          const { item } = row;
          const branch = row.lane > 0;
          const to = item.date_to?.trim() || null;
          const ongoing =
            !!item.date_from?.trim() && (!to || isOngoingWord(to));
          const duration = timelineDuration(item.date_from, item.date_to, now);

          const alongsideRow = branch
            ? trunkAlongside(graph.rows, index)
            : null;
          const alongside =
            alongsideRow !== null ? graph.rows[alongsideRow]?.item.title : null;
          const merge = graph.merges.find((edge) => edge.fromRow === index);
          const mergedInto = merge ? graph.rows[merge.toRow]?.item.title : null;

          const image = safeImageUrl(item.image_url);
          const linked = !!item.link_url;

          return (
            <li
              key={item.id}
              className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[9.5rem_1.5rem_minmax(0,1fr)] md:gap-x-6"
            >
              {/* When — its own column from md up, sticky beside a long card. */}
              <div className="hidden md:col-start-1 md:row-start-1 md:block md:self-start md:pt-5 md:sticky md:top-28">
                <Period item={item} duration={duration} ongoing={ongoing} />
              </div>

              {/* The rail cell. */}
              <div className="col-start-1 row-start-1 flex justify-center md:col-start-2">
                <Node
                  branch={branch}
                  ongoing={ongoing}
                  reduceMotion={reduceMotion}
                />
              </div>

              {/* What. */}
              <div
                className={cn(
                  "col-start-2 row-start-1 min-w-0 md:col-start-3",
                  branch && "md:ml-8",
                )}
              >
                <div className="md:hidden">
                  <Period
                    item={item}
                    duration={duration}
                    ongoing={ongoing}
                    compact
                  />
                </div>

                <article
                  className={cn(
                    "group rounded-surface bg-card p-5 shadow-e1 sm:p-6",
                    linked &&
                      "transition-shadow duration-base ease-enter hover:shadow-e2",
                  )}
                >
                  <div className="flex items-start gap-4">
                    {image && (
                      <ItemImage
                        src={image}
                        alt=""
                        className="size-11 shrink-0 rounded-control object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3
                        className={cn(
                          "font-heading font-semibold leading-snug [overflow-wrap:anywhere]",
                          branch ? "text-lg" : "text-lg sm:text-xl",
                        )}
                      >
                        <TextLink
                          href={item.link_url}
                          className="transition-colors hover:text-primary"
                        >
                          {item.title}
                        </TextLink>
                      </h3>
                      <PlainText
                        className="mt-0.5 text-sm text-muted-foreground"
                        clamp={2}
                      >
                        {item.subtitle}
                      </PlainText>
                    </div>
                    {linked && (
                      <ArrowUpRight
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-base ease-enter group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    )}
                  </div>

                  <Markdown className="mt-4 text-muted-foreground">
                    {item.description}
                  </Markdown>
                  <ItemTags tags={item.tags} className="mt-4" max={8} />

                  {(alongside || mergedInto) && (
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                      {alongside && (
                        <Relation
                          icon={
                            <GitBranch
                              className="size-3.5 shrink-0"
                              aria-hidden
                            />
                          }
                        >
                          Alongside {alongside}
                        </Relation>
                      )}
                      {mergedInto && (
                        <Relation
                          icon={
                            <GitMerge
                              className="size-3.5 shrink-0"
                              aria-hidden
                            />
                          }
                        >
                          Became part of {mergedInto}
                        </Relation>
                      )}
                    </div>
                  )}
                </article>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
