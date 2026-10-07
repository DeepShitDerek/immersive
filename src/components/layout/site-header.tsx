"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { SiteContent } from "@/types";
import {
  useGetNavLinksQuery,
  useGetSiteIdentityQuery,
} from "@/store/api/publicApi";
import { usePublicSession } from "@/hooks/use-public-session";
import { Skeleton } from "@/components/ui/skeleton";
import { SchemeToggle } from "./scheme-toggle";
import { cn } from "@/lib/cn";
import { splitNav } from "./nav-links";

/** Normalizes a route path for comparison (static export uses trailing slashes). */
function normalizePath(path: string): string {
  const stripped = path.replace(/\/+$/, "");
  return stripped === "" ? "/" : stripped;
}

export function isActivePath(pathname: string, href: string): boolean {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

/** Whether the page has scrolled past `threshold` pixels. */
function useScrolled(threshold: number): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}

/** Up to this many links share one row with the logo on a phone. */
const ONE_ROW_LINKS = 3;

/**
 * The site header: a plain bar, not a floating pill.
 *
 *  - **No menu.** Three or four links fit on any phone, and a link that is
 *    visible gets used; one behind a hamburger mostly does not.
 *    That also removes the old phone sheet, which let keyboard focus wander
 *    into the page behind it. Past three links, the links take a
 *    second row on phones rather than hide.
 *  - **One call to action.** "Work with me" ends the bar from `sm` up; on a
 *    phone the hero and the closing band carry it, so the bar never holds two
 *    filled buttons with the hero's in view.
 *  - **Solid when it matters.** It sits on the ground at the top and gains a
 *    hairline once content scrolls under it. The fill is the page ground at
 *    95%, so text under it can never show through at low contrast.
 *  - **The current page is underlined** in the primary colour, by CSS. There
 *    is no travelling pill, and no animation library in the bar.
 *
 * `identity` overrides the fetched row. Only the settings preview passes it, so
 * the preview renders the *real* header against unsaved form values.
 */
export default function SiteHeader({
  identity: identityOverride,
}: {
  identity?: SiteContent;
} = {}) {
  const pathname = usePathname() ?? "/";
  const { data: fetched, isLoading: isIdentityLoading } =
    useGetSiteIdentityQuery();
  const identity = identityOverride ?? fetched;
  const { data: navLinks, isLoading: isNavLoading } = useGetNavLinksQuery();
  const { session } = usePublicSession();
  const scrolled = useScrolled(8);

  const isLoading = (!identityOverride && isIdentityLoading) || isNavLoading;
  const logo = identity?.profile_data.logo;
  const wordmark = `${logo?.main ?? ""}${logo?.highlight ?? ""}`;
  // The contact link is the call to action, not one more text link.
  const { items: links, cta } = splitNav(navLinks ?? []);
  const twoRows = links.length > ONE_ROW_LINKS;

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        "sticky top-0 z-overlay border-b bg-background/95 backdrop-blur-sm",
        "transition-[border-color] duration-fast",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-content flex-wrap items-center gap-x-1 px-[var(--band-x)] max-[399px]:px-4 sm:gap-x-2"
      >
        <Link
          href="/"
          aria-label={wordmark ? `${wordmark}, home` : "Home"}
          className="-ml-1.5 flex h-14 min-w-0 items-center gap-2 rounded-control px-1.5 focus-ring"
        >
          {isLoading || !logo ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <>
              {/* The monogram stands in where the name would crowd the links. */}
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-control bg-foreground font-heading text-base font-semibold text-background min-[400px]:hidden"
              >
                {(logo.main || logo.highlight || "·").charAt(0).toUpperCase()}
              </span>
              <span
                aria-hidden
                className="truncate font-heading text-lg font-semibold tracking-tight max-[399px]:hidden"
              >
                <span className="text-foreground">{logo.main}</span>
                <span className="text-primary">{logo.highlight}</span>
              </span>
            </>
          )}
        </Link>

        <ul
          className={cn(
            "flex items-center",
            twoRows
              ? "-mx-2 order-last basis-full overflow-x-auto pb-2 sm:order-none sm:mx-0 sm:ml-auto sm:basis-auto sm:pb-0"
              : "ml-auto",
          )}
        >
          {isLoading ? (
            <li className="flex gap-3 px-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </li>
          ) : (
            links.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-control px-2 py-2.5 text-sm font-medium underline-offset-[0.4em] transition-colors duration-fast sm:px-3",
                      "decoration-2 focus-ring",
                      active
                        ? "text-foreground underline decoration-primary"
                        : "text-muted-foreground hover:text-foreground hover:underline hover:decoration-border",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })
          )}
        </ul>

        <div
          className={cn(
            "flex items-center gap-1",
            twoRows && "ml-auto sm:ml-0",
          )}
        >
          <SchemeToggle />
          {session && (
            <Link
              href="/admin"
              aria-label="Admin"
              title="Admin"
              className="inline-flex size-10 items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground focus-ring sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm sm:font-medium [@media(pointer:coarse)]:size-11"
            >
              <ShieldCheck className="size-4" aria-hidden />
              <span aria-hidden className="hidden sm:inline">
                Admin
              </span>
            </Link>
          )}
          {!isLoading && cta && (
            <Link
              href={cta.href}
              aria-current={
                isActivePath(pathname, cta.href) ? "page" : undefined
              }
              className="ml-1 hidden h-10 items-center gap-1.5 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-fast hover:bg-primary/90 focus-ring sm:inline-flex"
            >
              {cta.label}
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
