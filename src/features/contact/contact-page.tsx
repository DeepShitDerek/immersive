"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import { socialIcon } from "@/lib/social-icons";
import { siteContent } from "@/lib/site-content";
import { Band } from "@/components/layout/band";
import { PageHeader } from "@/components/layout/page-header";
import { Reveal, Stagger, StaggerItem } from "@/components/layout/motion";
import { DynamicPageContent } from "@/features/sections/dynamic-page-content";
import { isInternalUrl, safeLinkUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import type { SiteContent } from "@/types";
import { ContactForm } from "./contact-form";

export function ContactPage() {
  const { data: identity } = useGetSiteIdentityQuery();

  return (
    <ContactView
      identity={identity}
      form={<ContactForm />}
      services={<DynamicPageContent pagePath="/contact" />}
    />
  );
}

/**
 * Where a channel goes, said plainly under its name: the host for a web link,
 * the address for mail, the number for a phone. A visitor should know where a
 * tap lands before making it.
 */
export function channelDestination(href: string): string {
  if (href.startsWith("mailto:")) return href.slice(7).split("?")[0];
  if (href.startsWith("tel:")) return href.slice(4);
  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return href;
  }
}

/**
 * The contact page over identity passed in rather than fetched, with the two
 * blocks that carry their own data supplied as slots — so the settings
 * preview renders the same arrangement with inert stand-ins.
 */
export function ContactView({
  identity,
  form,
  services,
}: {
  identity: SiteContent | undefined;
  form: ReactNode;
  services: ReactNode;
}) {
  const toggles = identity?.profile_data.contact_page;
  const showForm = toggles?.show_contact_form ?? true;
  const showBadge = toggles?.show_availability_badge ?? true;
  const showServices = toggles?.show_services ?? true;

  /**
   * Only links that are visible *and* have a usable URL — a link filtered
   * inside the map still counted toward "are there any", and rendered a
   * heading over nothing.
   */
  const socials = (identity?.social_links ?? [])
    .filter((social) => social.is_visible)
    .map((social) => ({ ...social, href: safeLinkUrl(social.url) }))
    .filter((social): social is typeof social & { href: string } =>
      Boolean(social.href),
    );

  const hasSocials = socials.length > 0;

  /**
   * The grid is chosen, not assumed: two columns only when the form and the
   * links both exist; with one side absent the other takes the band.
   * Availability sits above both, because it is context for the whole page —
   * whether writing is worth it at all.
   */
  const twoColumn = showForm && hasSocials;

  return (
    <Band weight="content">
      <PageHeader
        kicker="Contact"
        title={siteContent.pages.contact.heading}
        subheading={siteContent.pages.contact.subheading}
      />

      {showBadge && (
        <Reveal className="mb-10">
          <p className="inline-flex items-center gap-2 font-mono text-micro text-muted-foreground">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-success"
            />
            {identity?.profile_data.status_panel.availability ||
              "Available for work"}
          </p>
        </Reveal>
      )}

      <div
        className={cn(
          "grid items-start gap-10",
          twoColumn && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12",
        )}
      >
        {showForm && (
          <Reveal>
            <section
              aria-label="Contact form"
              className="min-w-0 rounded-surface bg-card p-6 shadow-e2 sm:p-8"
            >
              <h2 className="font-heading text-lg font-semibold">
                Send a message
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every message is read by a person.
              </p>
              <div className="mt-6">{form}</div>
            </section>
          </Reveal>
        )}

        {hasSocials && (
          <aside className="min-w-0">
            <h2 className="t-eyebrow mb-4">Direct lines</h2>
            <Stagger
              as="ul"
              className={cn(
                "space-y-3",
                // With no form beside them the links would otherwise run the
                // full band width as one very wide row each.
                !showForm && "sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0",
              )}
            >
              {socials.map((social) => {
                const Icon = socialIcon(social.id);
                const external = !isInternalUrl(social.href);
                return (
                  <StaggerItem as="li" key={social.id}>
                    <a
                      href={social.href}
                      {...(external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="group flex items-center gap-4 rounded-surface bg-card p-4 shadow-e1 transition-shadow duration-fast hover:shadow-e2 focus-ring"
                    >
                      <span
                        aria-hidden
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-base group-hover:bg-primary group-hover:text-primary-foreground"
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {social.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {channelDestination(social.href)}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-base ease-enter group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                        aria-hidden
                      />
                    </a>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </aside>
        )}
      </div>

      {showServices && <div className="mt-24">{services}</div>}
    </Band>
  );
}
