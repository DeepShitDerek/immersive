"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/ui/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { socialIcon } from "@/lib/social-icons";
import type { SiteContent } from "@/types";
import {
  useGetNavLinksQuery,
  useGetSiteIdentityQuery,
} from "@/store/api/publicApi";
import { Band } from "@/components/layout/band";
import { isInternalUrl, safeLinkUrl } from "@/lib/safe-url";
import { footerLinks } from "./nav-links";
import { cn } from "@/lib/cn";

const FOCUS = "focus-ring";

/**
 * Footer.
 *
 * Kept: the markdown copyright and the 5-tap "©" easter egg that opens
 * /admin — both are behaviour, not decoration.
 */
export default function PublicFooter() {
  const router = useRouter();
  const { data: identity, isLoading } = useGetSiteIdentityQuery();
  const { data: links } = useGetNavLinksQuery();
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    if (clickCount === 0) return;
    const timer = setTimeout(() => setClickCount(0), 1000);
    if (clickCount === 5) {
      toast.success("Initializing Admin Sequence...");
      router.push("/admin");
      setClickCount(0);
    }
    return () => clearTimeout(timer);
  }, [clickCount, router]);

  if (isLoading || !identity) {
    return (
      <Band
        as="footer"
        weight="content"
        className="border-t border-border !pt-16"
      >
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-16 w-64" />
        </div>
      </Band>
    );
  }

  return (
    <FooterView
      identity={identity}
      links={links}
      onSecretTap={() => setClickCount((count) => count + 1)}
    />
  );
}

/**
 * The footer over identity passed in rather than fetched.
 *
 * The same view/container split as `HeroView`, `AboutView` and `ContactView`:
 * the settings preview renders the *real* footer against unsaved form values.
 * `links` is optional for the same reason — the preview has no navigation to
 * pass, and the footer composes from what it is given. The five-tap shortcut
 * is a prop so the preview never wires a gesture that would navigate away
 * from unsaved settings.
 *
 * Composition: an open sign-off on the page ground rather than a boxed panel.
 * A rule, then who and where — identity on the left, the site's pages and the
 * owner's channels on the right — and one quiet row to close. The name set
 * huge across the band in fading gradient text is gone: gradient text is off
 * the system, and it left a 250px gap.
 */
export function FooterView({
  identity,
  links,
  onSecretTap,
}: {
  identity: SiteContent;
  links?: { label: string; href: string }[];
  onSecretTap?: () => void;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const currentYear = new Date().getFullYear();
  const { profile_data, social_links, footer_data } = identity;

  const logo = profile_data.logo;
  const role = profile_data.title?.split("|")[0]?.trim();
  const availability = profile_data.status_panel?.availability?.trim();
  // The nav, plus footer-only pages (Updates by default) that left the
  // header in the work-led IA but stay one click away.
  const pages = footerLinks(links ?? [], footer_data.links).filter((link) =>
    safeLinkUrl(link.href),
  );
  const socials = social_links
    .filter((social) => social.is_visible)
    .map((social) => ({ ...social, href: safeLinkUrl(social.url) }))
    .filter((social): social is typeof social & { href: string } =>
      Boolean(social.href),
    );

  return (
    <Band
      as="footer"
      weight="content"
      // Footer follows a same-ground band, whose shared padding collapses; the
      // rule needs its own room above the content.
      className="border-t border-border !pb-0 !pt-16"
    >
      <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-sm space-y-3">
          <p className="font-heading text-lg font-bold tracking-tight">
            <span className="text-foreground">{logo?.main}</span>
            <span className="text-primary">{logo?.highlight}</span>
          </p>
          {role && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {role}
            </p>
          )}
          {availability && (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-success"
              />
              {availability}
            </p>
          )}
        </div>

        {(pages.length > 0 || socials.length > 0) && (
          <div className="flex flex-col gap-10 sm:flex-row sm:gap-20">
            {pages.length > 0 && (
              <nav aria-label="Footer">
                <ul className="grid grid-cols-2 gap-x-12 gap-y-3">
                  {pages.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={cn(
                          "rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors duration-fast hover:text-foreground hover:underline",
                          FOCUS,
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {socials.length > 0 && (
              <ul className="-ml-2 flex flex-wrap gap-1 sm:ml-0">
                {socials.map((social) => {
                  const Icon = socialIcon(social.id);
                  const external = !isInternalUrl(social.href);
                  return (
                    <li key={social.url}>
                      <a
                        href={social.href}
                        {...(external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        aria-label={social.label}
                        title={social.label}
                        className={cn(
                          "flex size-10 items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground [@media(pointer:coarse)]:size-11",
                          FOCUS,
                        )}
                      >
                        <Icon className="size-[1.125rem]" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-12 flex flex-col gap-4 border-t border-border py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p>
            <span onClick={onSecretTap} className="cursor-default select-none">
              &copy; {currentYear}
            </span>{" "}
            <span className="font-medium text-foreground">
              {profile_data.name}
            </span>
          </p>
          {footer_data.copyright_text && (
            <Markdown className="max-w-none text-sm text-muted-foreground [&_a]:text-primary [&_a]:no-underline [&_a]:underline-offset-4 [&_a:hover]:underline [&_p]:m-0">
              {footer_data.copyright_text}
            </Markdown>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: reduceMotion ? "auto" : "smooth",
            })
          }
          className={cn(
            "group inline-flex shrink-0 items-center gap-2 self-start rounded-control py-1 font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground sm:self-auto",
            FOCUS,
          )}
        >
          Back to top
          <ArrowUp
            className="size-4 transition-transform duration-fast group-hover:-translate-y-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        </button>
      </div>
    </Band>
  );
}
