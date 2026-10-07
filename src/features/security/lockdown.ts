import { Globe, Lock, ShieldAlert, type LucideIcon } from "lucide-react";

/**
 * What each lockdown level actually does.
 *
 * This module exists because the previous descriptions were not true. Level 2
 * was labelled "API Read-Only. No edits allowed." and nothing enforced it:
 * `lockdown_level` appears in the schema exactly twice — the column definition
 * and a seed row — and no RLS policy references it. Setting level 2 changed a
 * message on the public site and nothing else, so the owner could believe
 * writes were blocked while they were not.
 *
 * A security screen that overstates what it does is worse than one that does
 * less, so the copy here describes the enforcement that exists. Where a level
 * depends on a migration the owner may not have run, it says so.
 */

export interface LockdownLevelMeta {
  level: number;
  icon: LucideIcon;
  title: string;
  /** What actually happens, in the owner's terms. */
  summary: string;
  /** Where the rule is applied. Named because it decides how much to trust it. */
  enforcement: "none" | "client" | "database";
  tone: "normal" | "warning" | "critical";
}

export const LOCKDOWN_LEVELS: LockdownLevelMeta[] = [
  {
    level: 0,
    icon: Globe,
    title: "Open",
    summary: "The public site is live and everything works normally.",
    enforcement: "none",
    tone: "normal",
  },
  {
    level: 1,
    icon: Lock,
    title: "Maintenance",
    summary:
      "Visitors see a maintenance notice instead of the site. You can still sign in and edit.",
    enforcement: "client",
    tone: "warning",
  },
  {
    level: 2,
    icon: ShieldAlert,
    title: "Locked down",
    summary:
      "Maintenance, plus every admin write is refused by the database until you lower this.",
    enforcement: "database",
    tone: "critical",
  },
];

export function lockdownMeta(level: number): LockdownLevelMeta {
  return (
    LOCKDOWN_LEVELS.find((l) => l.level === level) ?? {
      // The column allows 0-3 but only three levels are defined. An unknown
      // value is treated as the strictest rather than the most permissive:
      // guessing "probably fine" about a security setting is the wrong
      // direction to be wrong in.
      level,
      icon: ShieldAlert,
      title: `Level ${level}`,
      summary: "Unrecognised level. Treated as fully locked down.",
      enforcement: "database",
      tone: "critical",
    }
  );
}

/**
 * The warning shown before changing level.
 *
 * Indexed lookup was the previous approach, and the column permits a level the
 * array has no entry for — `messages[3]` was `undefined`, which renders a
 * confirm dialog with no description at the exact moment one matters most.
 */
export function lockdownConfirmation(level: number): {
  title: string;
  description: string;
  destructive: boolean;
} {
  if (level === 0) {
    return {
      title: "Reopen the site?",
      description: "Visitors will be able to reach it again immediately.",
      destructive: false,
    };
  }

  if (level === 1) {
    return {
      title: "Turn on maintenance mode?",
      description:
        "Visitors will see a maintenance notice instead of your site. You keep full access.",
      destructive: false,
    };
  }

  return {
    title: `Lock down the site?`,
    description:
      "Visitors see a maintenance notice, and every admin write is refused until you set the level back. " +
      "You can always change the level itself — that is deliberately never blocked, so lockdown cannot trap you.",
    destructive: true,
  };
}
