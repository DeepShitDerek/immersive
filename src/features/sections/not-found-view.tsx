"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGetNavLinksQuery } from "@/store/api/publicApi";
import { Band } from "@/components/layout/band";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/layout/motion";
import { CmsPage } from "./cms-page";
import { resolveCmsPage } from "./cms-fallback";

/**
 * The 404 route, which is also where an unbuilt CMS page is caught.
 *
 * See `cms-fallback.ts` for why: a page created in the admin after the last
 * deploy is in the navigation but not in the build, and `404.html` is the only
 * file a static host will serve for a path it does not have. Rather than
 * telling the owner their own page does not exist, this asks the navigation
 * whether it should, and renders it if so.
 *
 * The path comes from `location`, not from `usePathname()`. On a static host
 * the visitor's URL is `/case-studies/` while the document served is
 * `404.html`, and the router reports the route it matched.
 */
export function NotFoundView() {
  const [pathname, setPathname] = useState<string | null>(null);
  const { data: links, isLoading } = useGetNavLinksQuery();

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  // Two things arrive after first paint — the path and the navigation — and
  // announcing "not found" before either would flash a 404 over a page that is
  // about to render. A skeleton is the honest state until both are in.
  if (pathname === null || isLoading) {
    return (
      <Band weight="content" aria-busy>
        <div className="space-y-4">
          <Skeleton className="h-4 w-28 rounded-control" />
          <Skeleton className="h-10 w-72 max-w-full rounded-control" />
          <Skeleton className="h-4 w-full max-w-prose rounded-control" />
        </div>
      </Band>
    );
  }

  const cmsPage = resolveCmsPage(pathname, links);
  if (cmsPage) {
    return <CmsPage pagePath={cmsPage.pagePath} title={cmsPage.title} />;
  }

  return <GenuineNotFound links={links ?? []} />;
}

/**
 * A 404 that offers a way forward rather than only a way back.
 *
 * The site's own pages are listed, from the navigation this view has already
 * loaded to decide whether the path was a CMS page — so a mistyped URL is one
 * tap from wherever the visitor was probably going.
 */
function GenuineNotFound({
  links,
}: {
  links: { label: string; href: string }[];
}) {
  const pages = links.filter((link) => link.href !== "/").slice(0, 6);

  return (
    <Band weight="feature">
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <Reveal>
          <p className="t-eyebrow">Page not found</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-4 font-heading text-[clamp(5rem,4rem+8vw,10rem)] font-bold leading-none tracking-tighter">
            4<span className="text-primary">0</span>4
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="t-lead mt-6 max-w-md text-pretty">
            This page doesn&apos;t exist — it may have been moved, renamed, or
            never shipped.
          </p>
        </Reveal>
        <Reveal delay={0.15} className="mt-10">
          <Button asChild size="lg">
            <Link href="/">
              <ArrowLeft className="mr-2 size-4" aria-hidden />
              Back home
            </Link>
          </Button>
        </Reveal>

        {pages.length > 0 && (
          <Reveal delay={0.2} className="mt-14 w-full">
            <nav aria-label="Suggested pages">
              <p className="t-micro">Or try one of these</p>
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {pages.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors duration-fast hover:border-input hover:text-foreground focus-ring"
                    >
                      {link.label}
                      <ArrowRight
                        aria-hidden
                        className="size-3.5 text-muted-foreground transition-transform duration-base ease-enter group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>
        )}
      </div>
    </Band>
  );
}
