"use client";

import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import { Band } from "@/components/layout/band";
import { Button } from "@/components/ui/button";
import { safeLinkUrl } from "@/lib/safe-url";

/**
 * The closing invitation: the page's second decision point, after the
 * evidence (information-architecture.md §3, row 7).
 *
 * It sits on the page ground under a rule, at the feature rhythm, on the same
 * left edge as every section above it, so the page reads as one flow from the
 * hero to here. Earlier versions put it on a tinted band inside a raised card;
 * the owner rejected them as a banner interrupting the page.
 *
 * One primary action, with the same label as the hero's, and email as the
 * secondary, offered only when a visible address exists.
 */
export function ContactCta() {
  const { data: identity } = useGetSiteIdentityQuery();
  const email = identity?.social_links.find(
    (social) => social.id.toLowerCase() === "email" && social.is_visible,
  );
  const emailHref = safeLinkUrl(email?.url);
  const availability =
    identity?.profile_data?.status_panel?.availability?.trim();

  return (
    <Band weight="feature" aria-labelledby="cta-heading">
      <div className="border-t border-border pt-12">
        <div className="max-w-hero">
          <h2
            id="cta-heading"
            className="t-title text-balance [overflow-wrap:anywhere]"
          >
            Let&apos;s build something that ships.
          </h2>
          <p className="t-lead mt-4 max-w-prose text-pretty">
            Have a project, a role, or just a question — my inbox is open.
          </p>
          {availability && (
            <p className="mt-4 inline-flex items-center gap-2 font-mono text-micro text-muted-foreground">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-success"
              />
              {availability}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="group">
              <Link href="/contact">
                Work with me
                <ArrowRight
                  aria-hidden
                  className="ml-2 size-4 transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            </Button>
            {emailHref && (
              <Button asChild size="lg" variant="outline">
                <a href={emailHref}>
                  <Mail className="mr-2 size-4" aria-hidden />
                  Email me directly
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Band>
  );
}
