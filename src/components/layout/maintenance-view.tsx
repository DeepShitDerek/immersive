"use client";

import { Lock, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Full-screen maintenance / lockdown view shown to non-admin visitors when
 * `security_settings.lockdown_level >= 1`.
 *
 * A calm floating card on a softly lit ground, in plain words. The previous
 * "status: maintenance" line was the v2 terminal voice, and "System lockdown"
 * told a visitor more about the owner's security settings than they needed —
 * all a visitor can act on is whether to come back.
 */
export default function MaintenanceView({ level }: { level: number }) {
  const isLockdown = level >= 2;
  const Icon = isLockdown ? Lock : Wrench;

  return (
    <div className="fixed inset-0 z-top flex items-center justify-center overflow-hidden bg-background p-6 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_0%,hsl(var(--primary)/0.14),transparent_70%)]"
      />
      <main className="relative w-full max-w-md rounded-surface bg-card p-8 text-center shadow-e3 sm:p-10">
        <div
          className={cn(
            "mx-auto flex size-14 items-center justify-center rounded-full",
            isLockdown
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </div>
        <h1 className="t-heading mt-6 text-balance">
          {isLockdown ? "Temporarily unavailable" : "Back shortly"}
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          {isLockdown
            ? "This site is closed for the moment. Please check back later."
            : "A few improvements are being made. The site will return in a little while."}
        </p>
        {!isLockdown && (
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <span aria-hidden className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
              <span className="relative size-1.5 rounded-full bg-primary" />
            </span>
            Maintenance in progress
          </p>
        )}
      </main>
    </div>
  );
}
