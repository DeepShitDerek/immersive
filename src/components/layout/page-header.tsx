"use client";

import type { ReactNode } from "react";
import { Reveal } from "@/components/layout/motion";
import { cn } from "@/lib/cn";

/**
 * The opener for a public page.
 *
 * Hierarchy is size and space: an eyebrow in the meta voice, the title at the
 * title size, a lead at reading measure. The display size belongs to the home
 * hero alone; every other page's h1 is a title, so a page
 * opens on its content rather than on a poster. Nothing in it animates.
 */
export function PageHeader({
  kicker,
  title,
  subheading,
  actions,
  className,
}: {
  kicker?: string;
  title: string;
  subheading?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-10 flex flex-col gap-6 sm:mb-14 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 max-w-4xl">
        {kicker && (
          <Reveal>
            <p className="t-eyebrow mb-3">{kicker}</p>
          </Reveal>
        )}
        <Reveal delay={0.05}>
          <h1 className="t-title text-balance [overflow-wrap:anywhere]">
            {title}
          </h1>
        </Reveal>
        {subheading && (
          <Reveal delay={0.1}>
            <p className="t-lead mt-4 max-w-prose text-pretty">{subheading}</p>
          </Reveal>
        )}
      </div>
      {actions && (
        <Reveal delay={0.15} className="flex shrink-0 items-center gap-2">
          {actions}
        </Reveal>
      )}
    </header>
  );
}
