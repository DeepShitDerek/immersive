"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import type { SiteContent } from "@/types";
import { Markdown } from "@/components/ui/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Band } from "@/components/layout/band";
import { safeImageUrl } from "@/lib/safe-url";
import { sizedImageUrl } from "@/lib/image-size";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/cn";
import { ProofStrip } from "./proof-strip";

const ROTATE_MS = 3200;

/**
 * Cycles through `title` parts separated by `|`; static when only one.
 *
 * The one piece of text on the site that moves, kept because it stops by
 * itself (WCAG 2.2.2): it goes round once and settles on the first
 * part, never moves under reduced motion, and a small button pauses it or
 * plays it again. Screen readers get every part once, in order, instead of
 * whichever one is showing. Each part fades in by CSS; there is no animation
 * library in the hero.
 */
function RotatingTitle({ title }: { title: string }) {
  const parts = title
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const [steps, setSteps] = useState(0);
  const index = parts.length ? steps % parts.length : 0;
  const reduceMotion = usePrefersReducedMotion();
  const [running, setRunning] = useState(false);

  // Start once mounted (and not under reduced motion); the server render
  // and the first paint show the first part, still.
  useEffect(() => {
    setRunning(parts.length > 1 && !reduceMotion);
  }, [parts.length, reduceMotion]);

  useEffect(() => {
    if (!running || parts.length < 2) return;
    const id = setInterval(() => setSteps((n) => n + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [running, parts.length]);

  // Back at the first part: a full cycle, so stop there.
  useEffect(() => {
    if (steps > 0 && parts.length > 1 && steps % parts.length === 0)
      setRunning(false);
  }, [steps, parts.length]);

  if (parts.length === 0) return null;
  if (parts.length === 1) return <span>{parts[0]}</span>;

  return (
    <>
      <span className="sr-only">{parts.join(", ")}</span>
      <span
        aria-hidden
        key={parts[index]}
        className={cn(
          "inline-block",
          steps > 0 &&
            "motion-safe:duration-slow motion-safe:animate-in motion-safe:fade-in-0",
        )}
      >
        {parts[index]}
      </span>
      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        aria-label={
          running ? "Pause the changing title" : "Play the changing title"
        }
        className="ml-1 inline-flex size-6 translate-y-[-0.1em] items-center justify-center rounded-control align-middle text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground focus-ring"
      >
        {running ? (
          <Pause aria-hidden className="size-3" />
        ) : (
          <Play aria-hidden className="size-3" />
        )}
      </button>
    </>
  );
}

/**
 * Who is available, as one line of meta. The dot is the success colour and
 * holds still: nothing on the first screen moves.
 */
function Availability({ label }: { label: string }) {
  return (
    <p className="inline-flex items-center gap-2 font-mono text-micro text-muted-foreground">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-success" />
      {label}
    </p>
  );
}

/**
 * Two ways forward: start the conversation, or look at the evidence first.
 * "Work with me", not "Start a project" — the same path serves a role, a
 * project or anything else, and it matches the header's CTA.
 */
function Actions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild size="lg" className="group max-[399px]:flex-1">
        <Link href="/contact">
          Work with me
          <ArrowRight
            aria-hidden
            className="ml-2 size-4 transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </Button>
      <Button
        asChild
        size="lg"
        variant="outline"
        className="max-[399px]:flex-1"
      >
        <Link href="/work">See the work</Link>
      </Button>
    </div>
  );
}

/** Who is making the promise in the headline. A paragraph, not a heading. */
function Byline({
  name,
  title,
  picture,
}: {
  name: string;
  title: string;
  picture: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      {picture && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sizedImageUrl(picture, 40)}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-full object-cover"
        />
      )}
      <p className="min-w-0 text-base leading-snug text-muted-foreground">
        <span className="font-semibold text-foreground">{name}</span>
        {title.trim() && (
          <>
            <span aria-hidden className="mx-2">
              ·
            </span>
            <RotatingTitle title={title} />
          </>
        )}
      </p>
    </div>
  );
}

/**
 * The setup and the payoff of a two-sentence headline, toned apart: the
 * setup in the secondary text colour, the payoff in the foreground (north
 * star §3.1). A one-sentence headline is all payoff.
 */
function splitHeadline(headline: string): [setup: string, payoff: string] {
  const match = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(headline.trim());
  return match ? [match[1], match[2]] : ["", headline.trim()];
}

function HeroSkeleton() {
  return (
    <Band weight="feature" aria-busy className="hero-band">
      <div className="max-w-hero space-y-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-36 w-full rounded-control" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-14 w-full max-w-prose rounded-control" />
        <div className="flex gap-3">
          <Skeleton className="h-12 w-40 rounded-control" />
          <Skeleton className="h-12 w-36 rounded-control" />
        </div>
      </div>
      <Skeleton className="mt-12 h-24 w-full rounded-control" />
    </Band>
  );
}

/** The identity band. */
export function Hero() {
  const { data: identity, isLoading } = useGetSiteIdentityQuery();

  if (isLoading || !identity) return <HeroSkeleton />;
  return <HeroView identity={identity} />;
}

/**
 * The opening of the home page.
 *
 * **It leads with the promise, not the name.** A visitor decides in a few
 * seconds whether this person solves their problem; a name answers a question
 * they have not asked yet. When the owner writes a headline it is the `h1`,
 * and the name and role become the byline under it. Without a headline the
 * name leads.
 *
 * **One composition, in reading order:** availability → promise → who →
 * what → two actions → results. At 1280×720 the actions end above 680px and
 * the results sit right under them; on a phone the results follow the
 * actions before anything else.
 *
 * **Nothing in it animates on load.** The headline is the largest paint on
 * the page; it used to fade in from `opacity: 0` after the animation library
 * loaded, which held every visitor's first meaningful paint for the length of
 * a script download. The status panel that shared this band moved to
 * About: what the owner is learning is not the first thing a buyer needs.
 *
 * Takes identity rather than fetching it, so the settings preview renders the
 * real hero against unsaved values.
 */
export function HeroView({ identity }: { identity: SiteContent }) {
  const { profile_data } = identity;
  const availability = profile_data.status_panel?.availability?.trim();
  const headline = profile_data.headline?.trim() ?? "";
  const proof = (profile_data.proof ?? []).filter((item) => item.value?.trim());
  const picture = profile_data.show_profile_picture
    ? safeImageUrl(profile_data.profile_picture_url)
    : null;
  const [setup, payoff] = splitHeadline(headline);

  return (
    <Band weight="feature" aria-labelledby="hero-name" className="hero-band">
      <div className="flex max-w-hero flex-col items-start gap-6">
        {availability && <Availability label={availability} />}

        {headline ? (
          <>
            <h1
              id="hero-name"
              className="t-display text-balance [overflow-wrap:anywhere]"
            >
              {setup && (
                <>
                  <span className="text-secondary-foreground">
                    {setup}
                  </span>{" "}
                </>
              )}
              {payoff}
            </h1>
            <Byline
              name={profile_data.name}
              title={profile_data.title ?? ""}
              picture={picture}
            />
          </>
        ) : (
          <div className="min-w-0">
            <h1
              id="hero-name"
              className="t-display text-balance [overflow-wrap:anywhere]"
            >
              {profile_data.name}
            </h1>
            {profile_data.title?.trim() && (
              <p className="t-heading mt-3 text-balance text-secondary-foreground">
                <RotatingTitle title={profile_data.title} />
              </p>
            )}
          </div>
        )}

        {profile_data.description && (
          <div className="t-lead max-w-prose text-pretty [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-foreground">
            <Markdown>{profile_data.description}</Markdown>
          </div>
        )}

        <div className="pt-2">
          <Actions />
        </div>
      </div>

      {proof.length > 0 && <ProofStrip items={proof} />}
    </Band>
  );
}
