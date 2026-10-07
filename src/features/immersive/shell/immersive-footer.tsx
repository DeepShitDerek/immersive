"use client";

import Link from "next/link";
import type { SiteContent } from "@/types";
import {
  useGetNavLinksQuery,
  useGetSiteIdentityQuery,
} from "@/store/api/publicApi";
import { Markdown } from "@/components/ui/markdown";
import { footerLinks } from "@/components/layout/nav-links";
import { isInternalUrl, safeLinkUrl } from "@/lib/safe-url";

const LINK =
  "im-mono inline-flex min-h-6 items-center rounded-control transition-colors duration-fast hover:text-foreground focus-ring";

/**
 * The footer for the immersive styles: a ruled strip. The big closing line
 * belongs to the home page's last beat, so this stays small on every page.
 *
 * `identity` overrides the fetched row, for the settings preview.
 */
export function ImmersiveFooter({
  identity: override,
}: {
  identity?: SiteContent;
}) {
  const { data: fetched } = useGetSiteIdentityQuery();
  const { data: navLinks } = useGetNavLinksQuery();
  const identity = override ?? fetched;
  if (!identity) return <footer className="im-rule h-24" />;

  const pages = footerLinks(navLinks ?? [], identity.footer_data.links);
  const socials = identity.social_links
    .filter((social) => social.is_visible)
    .map((social) => ({ ...social, href: safeLinkUrl(social.url) }))
    .filter((social): social is typeof social & { href: string } =>
      Boolean(social.href),
    );

  return (
    <footer className="im-rule px-[var(--band-x)] py-8 max-[399px]:px-4">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        {pages.length > 0 && (
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {pages.map((page) => (
                <li key={page.href}>
                  <Link href={page.href} className={LINK}>
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {socials.length > 0 && (
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {socials.map((social) => {
              const external = !isInternalUrl(social.href);
              return (
                <li key={social.url}>
                  <a
                    href={social.href}
                    className={LINK}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {social.label}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {identity.footer_data.copyright_text && (
        <Markdown className="mt-8 max-w-none text-sm text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_p]:m-0">
          {identity.footer_data.copyright_text}
        </Markdown>
      )}
    </footer>
  );
}
