"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { lockdownMeta } from "./lockdown";

/** Where the last backup's date is kept: this browser only, and said so. */
const LAST_BACKUP_KEY = "foliokit:last-backup";

/** A backup older than this is worth a nudge. */
const STALE_BACKUP_DAYS = 30;

type Tone = "good" | "warn" | "bad" | "unknown";

const TONE: Record<
  Tone,
  { icon: LucideIcon; className: string; word: string }
> = {
  good: { icon: CheckCircle2, className: "text-success", word: "OK" },
  warn: {
    icon: AlertTriangle,
    className: "text-warning",
    word: "Needs attention",
  },
  bad: {
    icon: AlertCircle,
    className: "text-destructive",
    word: "Action needed",
  },
  unknown: {
    icon: HelpCircle,
    className: "text-muted-foreground",
    word: "Unknown",
  },
};

export interface HealthRow {
  id: string;
  label: string;
  tone: Tone;
  text: string;
  /** The section on this page that fixes it. */
  href: string;
}

export function readLastBackup(): string | null {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function recordBackup(at: string) {
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, at);
  } catch {
    // Private windows can refuse storage; the backup itself still happened.
  }
}

/**
 * The three things that decide whether the account is safe, as words with
 * a status each. Pure, so the wording is tested rather than eyeballed.
 */
export function healthRows({
  factors,
  site,
  lastBackup,
  now = new Date(),
}: {
  factors: { loading: boolean; failed: boolean; verified: number };
  site: { loading: boolean; failed: boolean; level: number };
  lastBackup: string | null;
  now?: Date;
}): HealthRow[] {
  const twoFactor: HealthRow = factors.loading
    ? {
        id: "2fa",
        label: "Two-factor",
        tone: "unknown",
        text: "Checking…",
        href: "#two-factor",
      }
    : factors.failed
      ? {
          id: "2fa",
          label: "Two-factor",
          tone: "unknown",
          text: "Couldn't check your methods",
          href: "#two-factor",
        }
      : factors.verified === 0
        ? {
            id: "2fa",
            label: "Two-factor",
            tone: "bad",
            text: "No verified method: admin writes are refused",
            href: "#two-factor",
          }
        : factors.verified === 1
          ? {
              id: "2fa",
              label: "Two-factor",
              tone: "warn",
              text: "1 method. Add a second in case you lose it",
              href: "#two-factor",
            }
          : {
              id: "2fa",
              label: "Two-factor",
              tone: "good",
              text: `${factors.verified} methods`,
              href: "#two-factor",
            };

  let backup: HealthRow;
  const at = lastBackup ? new Date(lastBackup) : null;
  if (!at || Number.isNaN(at.getTime())) {
    backup = {
      id: "backup",
      label: "Backup",
      tone: "warn",
      text: "None downloaded in this browser",
      href: "#your-data",
    };
  } else {
    const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
    const when =
      days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
    backup = {
      id: "backup",
      label: "Backup",
      tone: days > STALE_BACKUP_DAYS ? "warn" : "good",
      text: `Last downloaded ${when}, in this browser`,
      href: "#your-data",
    };
  }

  let siteRow: HealthRow;
  if (site.loading) {
    siteRow = {
      id: "site",
      label: "Site",
      tone: "unknown",
      text: "Checking…",
      href: "#site-availability",
    };
  } else if (site.failed) {
    // Not "Open": a failed read must not look like the permissive answer.
    siteRow = {
      id: "site",
      label: "Site",
      tone: "unknown",
      text: "Couldn't read the availability level",
      href: "#site-availability",
    };
  } else {
    const meta = lockdownMeta(site.level);
    siteRow = {
      id: "site",
      label: "Site",
      tone:
        meta.tone === "normal"
          ? "good"
          : meta.tone === "warning"
            ? "warn"
            : "bad",
      text: meta.tone === "normal" ? "Open to visitors" : meta.title,
      href: "#site-availability",
    };
  }

  return [twoFactor, backup, siteRow];
}

/**
 * The summary at the top: every section had the
 * same weight, and the single-factor warning sat inside the 2FA card where
 * it was easy to scroll past.
 */
export function SecurityHealth({ rows }: { rows: HealthRow[] }) {
  return (
    <section
      aria-labelledby="security-health"
      className="rounded-surface border bg-card"
    >
      <h2 id="security-health" className="sr-only">
        Status
      </h2>
      <ul className="list-none divide-y p-0">
        {rows.map((row) => {
          const { icon: Icon, className, word } = TONE[row.tone];
          return (
            <li key={row.id}>
              <a
                href={row.href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40 focus-ring"
              >
                <Icon
                  aria-hidden
                  className={cn("size-4 shrink-0", className)}
                />
                <span className="w-24 shrink-0 text-sm font-medium">
                  {row.label}
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                  <span className="sr-only">{word}: </span>
                  {row.text}
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
