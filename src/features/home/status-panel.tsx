"use client";

import { ArrowUpRight } from "lucide-react";
import type { SiteContent } from "@/types";
import { Surface } from "@/components/layout/surface";
import { safeLinkUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";

type StatusPanelData = SiteContent["profile_data"]["status_panel"];

/**
 * The hero's status panel, in three owner-selectable designs.
 *
 * The stored values are still `minimal`, `terminal` and `bento` — rows in the
 * database carry them — but the two latter designs were replaced, and the
 * settings labels now name what they are: **Spotlight** and **Stack**.
 *
 *  - **Minimal** — a short numbered list of what the owner is exploring,
 *    closing on the latest project as a strip.
 *  - **Spotlight** (`terminal`) — an inverted card that makes the latest
 *    project the headline. It replaced a terminal imitation, and with it the
 *    panel's only monospace.
 *  - **Stack** (`bento`) — the exploring items as cards stacked like a wallet,
 *    each showing its top edge, the project card in front; the stack fans open
 *    on hover or focus. It replaced a tile grid.
 */

function exploring(panel: StatusPanelData): string[] {
  return panel.currently_exploring.items.filter((item) => item.trim());
}

function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative flex size-2", className)}>
      <span className="absolute inset-0 animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
      <span className="relative size-2 rounded-full bg-primary" />
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Minimal
 * ──────────────────────────────────────────────────────────────── */

/**
 * The latest project as the panel's closing strip — the one thing on the
 * panel a visitor can act on, so it gets the full width and its own ground.
 */
function ProjectStrip({ panel }: { panel: StatusPanelData }) {
  const href = safeLinkUrl(panel.latestProject.href);
  if (!panel.latestProject.name) return null;

  const body = (
    <>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">
          Latest project
        </span>
        <span className="mt-0.5 block truncate font-semibold transition-colors group-hover:text-primary">
          {panel.latestProject.name}
        </span>
      </span>
      {href && (
        <span className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-e1 transition-[background-color,color] duration-base ease-enter group-hover:bg-primary group-hover:text-primary-foreground">
          <ArrowUpRight className="size-4" aria-hidden />
        </span>
      )}
    </>
  );

  const strip = "flex items-center gap-4 bg-secondary/60 px-6 py-4";
  return href ? (
    <a
      href={href}
      aria-label={
        panel.latestProject.linkText
          ? `${panel.latestProject.linkText}: ${panel.latestProject.name}`
          : panel.latestProject.name
      }
      className={cn(
        "group transition-colors duration-base hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        strip,
      )}
    >
      {body}
    </a>
  ) : (
    <div className={strip}>{body}</div>
  );
}

/**
 * Rows rather than chips: a wrap of pills reads as a tag cloud, where a short
 * numbered list reads as priorities — which is what "currently exploring" is.
 */
function MinimalPanel({ panel }: { panel: StatusPanelData }) {
  const items = exploring(panel);
  const hasProject = Boolean(panel.latestProject.name);

  return (
    <Surface elevation={2} className="overflow-hidden p-0">
      <div className={cn("px-6 pt-6", !hasProject && "pb-6")}>
        <p className="flex items-center gap-2.5 font-heading text-base font-semibold">
          <LiveDot />
          {panel.title}
        </p>

        {items.length > 0 && (
          <div className="mt-5">
            <p className="t-micro">{panel.currently_exploring.title}</p>
            <ol className="mt-2 divide-y divide-border/60">
              {items.map((item, index) => (
                <li key={item} className="flex items-center gap-3 py-3 text-sm">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6875rem] font-semibold tabular-nums text-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {hasProject && (
        <div className={items.length > 0 ? "mt-3" : "mt-6"}>
          <ProjectStrip panel={panel} />
        </div>
      )}
    </Surface>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Spotlight (stored as `terminal`)
 * ──────────────────────────────────────────────────────────────── */

/**
 * The latest project as a headline, on an inverted card.
 *
 * `bg-foreground` / `text-background` invert with every preset — dark on a
 * light theme, light on a dark one — and that pair is the one every preset is
 * contrast-gated on, so the card is legible everywhere without a colour of
 * its own. Every label is full-strength `text-background` and the chips are
 * outlined rather than tinted: faded text and a tinted chip each fell under
 * AA on the Solarized, One Dark and Everforest presets.
 */
function SpotlightPanel({ panel }: { panel: StatusPanelData }) {
  const items = exploring(panel);
  const href = safeLinkUrl(panel.latestProject.href);
  const project = panel.latestProject.name;

  return (
    <div
      data-design="spotlight"
      className="relative isolate overflow-hidden rounded-surface bg-foreground p-7 text-background shadow-e3 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.45),transparent)]"
      />

      <p className="flex items-center gap-2.5 text-sm font-medium text-background">
        <LiveDot />
        {panel.title}
      </p>

      {project && (
        <div className="mt-8">
          <p className="text-xs font-medium text-background">Latest project</p>
          <p className="mt-1.5 font-heading text-3xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">
            {project}
          </p>
          {href && (
            <a
              href={href}
              className="group mt-6 inline-flex items-center gap-2 rounded-full bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors duration-base hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              {panel.latestProject.linkText || "Take a look"}
              <ArrowUpRight
                aria-hidden
                className="size-4 transition-transform duration-base ease-enter group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </a>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div
          className={cn(
            project ? "mt-8 border-t border-background/15 pt-6" : "mt-6",
          )}
        >
          <p className="text-xs font-medium text-background">
            {panel.currently_exploring.title}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => (
              <li
                key={item}
                className="rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ring-background/40"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Stack (stored as `bento`)
 * ──────────────────────────────────────────────────────────────── */

/**
 * The exploring items as cards stacked like a wallet, the project card in
 * front. Each back card shows its top edge, where its label sits, so every
 * item is readable at rest — fanning out on hover or keyboard focus is a
 * flourish, not a requirement, which matters on a phone with no hover.
 */
function StackPanel({ panel }: { panel: StatusPanelData }) {
  const items = exploring(panel).slice(0, 4);
  const href = safeLinkUrl(panel.latestProject.href);
  const project = panel.latestProject.name;

  const overlap =
    "-mt-7 transition-[margin] duration-slow ease-enter group-hover/stack:mt-2 group-focus-within/stack:mt-2 motion-reduce:transition-none";

  const front = (
    <>
      <p className="flex items-center gap-2.5 text-sm font-semibold">
        <LiveDot />
        {panel.title}
      </p>
      {project && (
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Latest project</p>
            <p className="mt-0.5 truncate font-heading text-xl font-semibold transition-colors group-hover/front:text-primary">
              {project}
            </p>
          </div>
          {href && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-e1">
              <ArrowUpRight className="size-4" aria-hidden />
            </span>
          )}
        </div>
      )}
    </>
  );

  return (
    <div data-design="stack" className="group/stack">
      {items.length > 0 && (
        <p className="t-micro mb-3">{panel.currently_exploring.title}</p>
      )}
      <ul>
        {items.map((item, index) => (
          <li
            key={item}
            className={cn(
              "relative flex h-16 items-start gap-3 rounded-surface bg-card px-5 pt-3 shadow-e1",
              index > 0 && overlap,
            )}
            style={{ zIndex: index + 1 }}
          >
            <span
              aria-hidden
              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
              style={{ opacity: 0.4 + (0.6 * (index + 1)) / items.length }}
            />
            <span className="min-w-0 truncate text-sm font-medium">{item}</span>
          </li>
        ))}
      </ul>
      {href ? (
        <a
          href={href}
          aria-label={
            panel.latestProject.linkText
              ? `${panel.latestProject.linkText}: ${project}`
              : project
          }
          className={cn(
            "group/front relative block rounded-surface bg-card p-6 shadow-e2 focus-ring",
            items.length > 0 && overlap,
          )}
          style={{ zIndex: 10 }}
        >
          {front}
        </a>
      ) : (
        <div
          className={cn(
            "relative rounded-surface bg-card p-6 shadow-e2",
            items.length > 0 && overlap,
          )}
          style={{ zIndex: 10 }}
        >
          {front}
        </div>
      )}
    </div>
  );
}

export function StatusPanel({ panel }: { panel: StatusPanelData }) {
  if (!panel.show) return null;
  if (panel.design === "terminal") return <SpotlightPanel panel={panel} />;
  if (panel.design === "bento") return <StackPanel panel={panel} />;
  return <MinimalPanel panel={panel} />;
}
