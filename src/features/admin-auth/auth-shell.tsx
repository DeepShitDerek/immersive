"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import { useGetSetupStatusQuery } from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { BUCKET_NAME } from "@/lib/constants";
import { PRODUCT } from "@/lib/product";
import { cn } from "@/lib/cn";
import { AuthPanel, AuthPending } from "./auth-card";

const WORKSPACE_POINTS = [
  {
    icon: PenLine,
    title: "Publish",
    text: "Pages, posts and updates, edited in the browser.",
  },
  {
    icon: CalendarCheck,
    title: "Plan",
    text: "Tasks, calendar, notes and habits in one place.",
  },
  {
    icon: Wallet,
    title: "Keep track",
    text: "Money, learning and what you own.",
  },
];

function Brand({ className }: { className?: string }) {
  const { data: identity } = useGetSiteIdentityQuery();
  const logo = identity?.profile_data.logo;
  const text = `${logo?.main ?? ""}${logo?.highlight ?? ""}`.trim();
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-control focus-ring",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground"
      >
        {(text || identity?.profile_data.name || "·").charAt(0).toUpperCase()}
      </span>
      <span className="font-heading text-base font-bold tracking-tight">
        {logo?.main || logo?.highlight ? (
          <>
            <span>{logo?.main}</span>
            <span className="text-primary">{logo?.highlight}</span>
          </>
        ) : (
          "Workspace"
        )}
      </span>
    </Link>
  );
}

/**
 * The stage for every sign-in screen: what is behind the door on one side,
 * the door on the other.
 *
 * The left panel is for the moment someone arrives here for the first time —
 * a new owner who has just installed the site should see what they are
 * signing in to, not a bare form. On a phone it gives way to the form.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <aside
        aria-label="About this workspace"
        className="relative isolate hidden overflow-hidden bg-card p-12 lg:flex lg:flex-col lg:justify-between"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_15%_20%,hsl(var(--primary)/0.16),transparent_70%)]"
        />
        <Brand />
        <div className="max-w-md">
          <p className="t-eyebrow">Private workspace</p>
          <h2 className="t-title mt-3 text-balance">
            Your site and your life, run from one place.
          </h2>
          <ul className="mt-10 space-y-5">
            {WORKSPACE_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.title} className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
                    <Icon className="size-[1.125rem]" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-medium">{point.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {point.text}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          Two-factor sign-in, enforced by the database.
        </p>
      </aside>

      <main className="flex min-h-[100dvh] flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Brand className="lg:invisible" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-ring"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to the site
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <SetupGate>{children}</SetupGate>
        </div>
      </main>
    </div>
  );
}

/**
 * Sign-in only once there is something to sign in to. A site without a
 * database, or with one whose schema was never run, gets the steps to finish
 * instead of a form that cannot succeed.
 */
function SetupGate({ children }: { children: ReactNode }) {
  const {
    data: status,
    isLoading,
    refetch,
    isFetching,
  } = useGetSetupStatusQuery();

  if (isLoading) return <AuthPending text="Checking this site's setup…" />;
  if (status === "no-database" || status === "no-schema") {
    return (
      <SetupGuide
        status={status}
        onRecheck={() => void refetch()}
        rechecking={isFetching}
      />
    );
  }
  return <>{children}</>;
}

function SetupGuide({
  status,
  onRecheck,
  rechecking,
}: {
  status: "no-database" | "no-schema";
  onRecheck: () => void;
  rechecking: boolean;
}) {
  const guide = PRODUCT.repoUrl
    ? `${PRODUCT.repoUrl}#dynamic-mode-setup`
    : null;

  const steps =
    status === "no-database"
      ? [
          {
            title: "Create a Supabase project",
            text: (
              <>
                The free tier is enough. Create one at{" "}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  supabase.com
                </a>
                .
              </>
            ),
          },
          {
            title: "Add its two keys",
            text: (
              <>
                Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
                <code>.env.local</code> — or your host&apos;s settings — and
                rebuild.
              </>
            ),
          },
          {
            title: "Run the schema",
            text: (
              <>
                Paste <code>db/schema.sql</code> into the Supabase SQL editor
                and run it. It creates the tables, the security policies and the
                defaults.
              </>
            ),
          },
          {
            title: "Add a storage bucket",
            text: (
              <>
                Create a public bucket named <code>{BUCKET_NAME}</code> for
                images.
              </>
            ),
          },
        ]
      : [
          {
            title: "Open the SQL editor",
            text: "In your Supabase project, open SQL Editor → New query.",
          },
          {
            title: "Run the schema",
            text: (
              <>
                Paste <code>db/schema.sql</code> and run it — the tables, the
                security policies and the defaults, in one go. It is safe to run
                again.
              </>
            ),
          },
          {
            title: "Add a storage bucket",
            text: (
              <>
                Create a public bucket named <code>{BUCKET_NAME}</code> for
                images.
              </>
            ),
          },
        ];

  return (
    <AuthPanel
      wide
      title={
        status === "no-database"
          ? "Connect a database to open the workspace"
          : "One step left: set up the database"
      }
      description={
        status === "no-database"
          ? "The public site works as it is. The private workspace behind it needs a Supabase project of your own."
          : "Supabase is connected, but its tables are not there yet."
      }
    >
      <ol className="space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary"
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.8125rem] [&_code]:text-foreground">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-muted-foreground">
        Then come back here to create your account.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {status === "no-schema" && (
          <Button onClick={onRecheck} disabled={rechecking}>
            <RefreshCw
              className={cn("mr-2 size-4", rechecking && "animate-spin")}
              aria-hidden
            />
            Check again
          </Button>
        )}
        {guide && (
          <Button variant="outline" asChild>
            <a href={guide} target="_blank" rel="noopener noreferrer">
              Read the setup guide
              <ArrowUpRight className="ml-1.5 size-4" aria-hidden />
            </a>
          </Button>
        )}
      </div>
    </AuthPanel>
  );
}
