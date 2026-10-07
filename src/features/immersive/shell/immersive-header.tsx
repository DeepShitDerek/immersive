"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SiteContent } from "@/types";
import {
  useGetNavLinksQuery,
  useGetSiteIdentityQuery,
} from "@/store/api/publicApi";
import { usePublicSession } from "@/hooks/use-public-session";
import { isActivePath } from "@/components/layout/site-header";
import { splitNav } from "@/components/layout/nav-links";
import { cn } from "@/lib/cn";

const LINK =
  "im-mono block rounded-control px-2 py-2.5 transition-colors duration-fast hover:text-foreground focus-ring sm:px-3";

/**
 * The header for the immersive styles: the wordmark, the links, the call to
 * action, all in the meta face.
 *
 * Like the Classic header it has no menu: past three links they take a second
 * row on a phone rather than hide. It has no light/dark toggle, because an
 * immersive style fixes its own scheme.
 *
 * `identity` overrides the fetched row, for the settings preview.
 */
export function ImmersiveHeader({
  identity: override,
}: {
  identity?: SiteContent;
}) {
  const pathname = usePathname() ?? "/";
  const { data: fetched } = useGetSiteIdentityQuery();
  const { data: navLinks } = useGetNavLinksQuery();
  const { session } = usePublicSession();
  const identity = override ?? fetched;
  const logo = identity?.profile_data.logo;
  const wordmark = `${logo?.main ?? ""}${logo?.highlight ?? ""}`;
  const { items, cta } = splitNav(navLinks ?? []);
  const links = cta ? [...items, cta] : items;

  return (
    <header className="sticky top-0 z-overlay border-b border-border bg-background/85 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="flex flex-wrap items-center gap-x-1 px-[var(--band-x)] max-[399px]:px-4"
      >
        <Link
          href="/"
          aria-label={wordmark ? `${wordmark}, home` : "Home"}
          className="-ml-2 flex h-14 min-w-0 items-center rounded-control px-2 font-heading text-base font-semibold tracking-tight text-foreground focus-ring"
        >
          <span aria-hidden className="truncate">
            {logo?.main}
            <span className="text-primary">{logo?.highlight}</span>
          </span>
        </Link>
        <ul
          className={cn(
            "flex items-center",
            links.length > 3
              ? "-mx-2 order-last basis-full overflow-x-auto pb-2 sm:order-none sm:mx-0 sm:ml-auto sm:basis-auto sm:pb-0"
              : "ml-auto",
          )}
        >
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    LINK,
                    active &&
                      "text-foreground underline decoration-primary decoration-2 underline-offset-[0.5em]",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          {session && (
            <li className="shrink-0">
              <Link href="/admin" className={LINK}>
                Admin
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
