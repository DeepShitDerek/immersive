"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import { Band, BandHeading } from "@/components/layout/band";
import { Stagger, StaggerItem } from "@/components/layout/motion";
import { ProofStrip } from "@/features/home/proof-strip";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { THEME_PRESETS } from "@/lib/constants";
import { applyTheme, resolveThemeClass } from "@/lib/themes";
import { PRODUCT, type ProductPlan } from "@/lib/product";
import { isInternalUrl, safeLinkUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import { FaqLayout, ProcessLayout } from "@/features/sections/layouts-sales";
import {
  FAQ,
  FEATURED_THEMES,
  MODES,
  PRODUCT_FACTS,
  QUICK_START,
  QUICK_START_CODE,
  SECURITY,
  WORKSPACE,
} from "./product-content";

/** A link that opens outside the site in a new tab, and stays in it otherwise. */
function Cta({
  href,
  children,
  variant = "default",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline";
  className?: string;
}) {
  const safe = safeLinkUrl(href);
  if (!safe) return null;
  const classes = cn(className);
  return isInternalUrl(safe) ? (
    <Button asChild size="lg" variant={variant} className={classes}>
      <Link href={safe}>{children}</Link>
    </Button>
  ) : (
    <Button asChild size="lg" variant={variant} className={classes}>
      <a href={safe} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  );
}

function PrimaryActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Cta href={PRODUCT.repoUrl || "#plans"} className="group">
        Get {PRODUCT.name}
        <ArrowRight
          aria-hidden
          className="ml-2 size-4 transition-transform duration-base ease-enter group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </Cta>
      <Cta href="#plans" variant="outline">
        See plans
      </Cta>
    </div>
  );
}

/**
 * The live preview: pick a theme and this whole page takes it.
 *
 * It is a preview, not a setting. The site's own theme comes back when the
 * visitor presses Reset or leaves the page — and the theme sync re-applies the
 * owner's choice on the next load regardless.
 *
 * Each swatch carries its preset's class on itself, so it is drawn in that
 * preset's own colours before it is chosen.
 */
function ThemePreview() {
  const { data: identity } = useGetSiteIdentityQuery();
  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const typography = identity?.profile_data.typography_preset || "typo-default";

  const restore = () => {
    const site = identityRef.current?.profile_data;
    applyTheme(
      resolveThemeClass(site?.default_theme),
      site?.typography_preset || "typo-default",
      site?.custom_theme_colors,
    );
  };

  useEffect(
    () => () => {
      if (activeRef.current) restore();
    },
    [],
  );

  const labels = new Map(
    THEME_PRESETS.map((t) => [t.value as string, t.label]),
  );

  return (
    <div>
      <div
        role="group"
        aria-label="Preview a theme"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {FEATURED_THEMES.map((theme) => {
          const selected = active === theme;
          return (
            <button
              key={theme}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setActive(theme);
                applyTheme(theme, typography, undefined);
              }}
              className={cn(
                "group rounded-surface bg-card p-2 text-left transition-shadow duration-base ease-enter",
                "focus-ring",
                selected
                  ? "shadow-e3 ring-2 ring-primary"
                  : "shadow-e1 hover:shadow-e2",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  theme,
                  "flex h-14 overflow-hidden rounded-control bg-background p-2",
                )}
              >
                <span className="flex flex-1 flex-col justify-between rounded-[0.25rem] bg-card p-1.5">
                  <span className="h-1.5 w-2/3 rounded-full bg-foreground/70" />
                  <span className="h-1.5 w-1/2 rounded-full bg-muted-foreground/50" />
                </span>
                <span className="ml-1.5 w-5 rounded-[0.25rem] bg-primary" />
              </span>
              <span className="mt-2 block truncate px-1 text-sm font-medium">
                {labels.get(theme) ?? theme}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {active
            ? `Previewing ${labels.get(active) ?? active} — the whole page has switched.`
            : `${FEATURED_THEMES.length} of ${THEME_PRESETS.length} themes. Pick one and this page switches to it.`}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => {
              setActive(null);
              restore();
            }}
            className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 font-medium text-foreground hover:bg-secondary focus-ring"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset to this site&apos;s theme
          </button>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: ProductPlan }) {
  return (
    <article
      aria-label={plan.name}
      className={cn(
        "flex min-w-0 flex-col rounded-surface bg-card p-7 sm:p-8",
        plan.highlighted ? "shadow-e3 ring-2 ring-primary" : "shadow-e1",
      )}
    >
      <h3 className="font-heading text-lg font-semibold">{plan.name}</h3>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-4xl font-bold tracking-tight">
          {plan.price}
        </span>
        {plan.period && (
          <span className="text-sm text-muted-foreground">{plan.period}</span>
        )}
      </p>
      <p className="mt-3 text-pretty text-muted-foreground">
        {plan.description}
      </p>
      {plan.features.length > 0 && (
        <ul className="mt-6 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <Check
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
              <span className="[overflow-wrap:anywhere]">{feature}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-8">
        <Cta
          href={plan.cta.href}
          variant={plan.highlighted ? "default" : "outline"}
          className="w-full"
        >
          {plan.cta.label}
        </Cta>
      </div>
    </article>
  );
}

/**
 * /kit — Foliokit, sold the way a product is.
 *
 * Promise, proof, what you get, how it is kept safe, what it costs, how to
 * start, and the questions a buyer asks — in that order, each band one idea.
 * The figures are counted from the code and the plans come from the owner's
 * config; nothing on this page is a number or a price someone made up.
 */
export function ProductPage() {
  return (
    <>
      {/*
        The same opening as the home hero: one column at the hero measure,
        left-aligned on the page's one axis, no glow behind it, nothing
        fading in, and the figures as a ruled list straight under the
        actions. The disclosure line answers "what does it cost and what is
        it built on" before anyone has to ask (conversion-strategy.md §6).
      */}
      <Band
        weight="feature"
        aria-labelledby="kit-heading"
        className="hero-band"
      >
        <div className="flex max-w-hero flex-col items-start gap-6">
          <p className="t-eyebrow">{PRODUCT.name}</p>
          <h1 id="kit-heading" className="t-display text-balance">
            Your portfolio and your personal OS, in one repo.
          </h1>
          <p className="t-lead max-w-prose text-pretty">
            A developer portfolio that deploys as static files for free — and,
            once you connect Supabase, a private workspace for writing,
            planning, money and learning behind mandatory two-factor sign-in.
          </p>
          <div className="pt-2">
            <PrimaryActions />
          </div>
          <p className="font-mono text-micro text-muted-foreground">
            Free · MIT licence · Next.js 16 + Supabase · static on GitHub Pages
          </p>
          <p className="text-sm text-muted-foreground">
            You&apos;re looking at it —{" "}
            <Link
              href="/"
              className="rounded-control font-medium text-foreground underline underline-offset-4 focus-ring"
            >
              this site
            </Link>{" "}
            is built with {PRODUCT.name}.
          </p>
        </div>

        <ProofStrip items={[...PRODUCT_FACTS]} label="By the numbers" />
      </Band>

      <Band weight="content" aria-labelledby="kit-modes">
        <BandHeading
          id="kit-modes"
          eyebrow="Two ways to run it"
          title="Start as a static site. Add the workspace when you want it."
        />
        <Stagger className="mt-10 grid gap-5 md:grid-cols-2">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <StaggerItem
                key={mode.name}
                className="flex min-w-0 flex-col border-t border-border pt-6"
              >
                <span className="flex size-11 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-heading text-xl font-semibold">
                  {mode.name}
                </h3>
                <p className="mt-1 text-muted-foreground">{mode.tagline}</p>
                <ul className="mt-6 space-y-2.5">
                  {mode.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Check
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-primary"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Band>

      <Band weight="content" aria-labelledby="kit-workspace">
        <BandHeading
          id="kit-workspace"
          eyebrow="The workspace"
          title="Everything behind the site, in one place."
          lead="Sign in once, with two-factor, and the same app runs your public pages and your private life."
        />
        <div className="mt-12 space-y-12">
          {WORKSPACE.map((group) => (
            <section key={group.group} aria-label={group.group}>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-lg font-semibold">
                  {group.group}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {group.description}
                </p>
              </div>
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <StaggerItem
                      key={module.href}
                      className="flex min-w-0 gap-4 border-t border-border pt-5"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-secondary text-foreground">
                        <Icon className="size-[1.125rem]" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{module.name}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {module.description}
                        </span>
                      </span>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </section>
          ))}
        </div>
      </Band>

      <Band weight="content" aria-labelledby="kit-themes">
        <BandHeading
          id="kit-themes"
          eyebrow="Make it yours"
          title="Try a theme on this page."
          lead="Every theme is checked for WCAG AA contrast, and visitors can switch too. You can also bring your own colours."
        />
        <div className="mt-10">
          <ThemePreview />
        </div>
      </Band>

      <Band weight="content" aria-labelledby="kit-security">
        <BandHeading
          id="kit-security"
          eyebrow="Private by design"
          title="Your data, in your own database, behind two-factor."
        />
        <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY.map((point) => {
            const Icon = point.icon;
            return (
              <StaggerItem
                key={point.title}
                className="min-w-0 border-t border-border pt-5"
              >
                <Icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-4 font-heading text-base font-semibold">
                  {point.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {point.text}
                </p>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Band>

      {PRODUCT.plans.length > 0 && (
        <Band
          weight="content"
          id="plans"
          aria-labelledby="kit-plans"
          className="scroll-mt-24"
        >
          <BandHeading
            id="kit-plans"
            eyebrow="Plans"
            title="Run it yourself, or have it set up for you."
          />
          <div
            className={cn(
              "mt-10 grid items-stretch gap-5",
              PRODUCT.plans.length === 2 && "md:grid-cols-2 lg:max-w-4xl",
              PRODUCT.plans.length >= 3 && "md:grid-cols-3",
            )}
          >
            {PRODUCT.plans.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </div>
        </Band>
      )}

      <Band weight="content" aria-labelledby="kit-start">
        <BandHeading
          id="kit-start"
          eyebrow="Getting started"
          title="From clone to live site in four steps."
        />
        <div className="mt-10">
          <ProcessLayout items={QUICK_START} />
        </div>
        <div className="mt-8 max-w-2xl">
          <Markdown>{QUICK_START_CODE}</Markdown>
        </div>
      </Band>

      <Band weight="content" aria-labelledby="kit-faq">
        <BandHeading
          id="kit-faq"
          eyebrow="Questions"
          title="What people ask first."
        />
        <div className="mt-10">
          <FaqLayout items={FAQ} />
        </div>
      </Band>

      <Band weight="feature" aria-labelledby="kit-close">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 id="kit-close" className="t-title text-balance">
            Ship your portfolio. Keep your life in the same place.
          </h2>
          <p className="t-lead text-pretty">
            Free and open source. Set up for you if you&apos;d rather not.
          </p>
          <PrimaryActions className="justify-center" />
        </div>
      </Band>
    </>
  );
}
