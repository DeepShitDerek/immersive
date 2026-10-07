"use client";

import { useRef } from "react";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import { ContactForm } from "@/features/contact/contact-form";
import { channelDestination } from "@/features/contact/contact-page";
import { DynamicPageContent } from "@/features/sections/dynamic-page-content";
import { isInternalUrl, safeLinkUrl } from "@/lib/safe-url";
import { siteContent } from "@/lib/site-content";
import { cn } from "@/lib/cn";
import { useScene, type Scene } from "../motion/scroll-provider";
import { Rule, WithScroll } from "../shared/ruled";

/** The heading grows into place as the page opens out. */
function headingScene({ gsap, el }: Scene) {
  gsap.from(el.querySelector("[data-line]"), {
    scale: 0.86,
    transformOrigin: "left bottom",
    ease: "none",
    // From the top of the page over the first screenful. The heading is in
    // view on arrival, so the range is in scroll distance, not in where the
    // heading sits: a range tied to its position can be empty.
    scrollTrigger: { trigger: el, start: 0, end: "+=320", scrub: true },
  });
}

/**
 * Contact in an immersive style: the page's heading set very large, the
 * direct lines in the meta face, and the same form.
 *
 * The form is the Classic `ContactForm`, so validation and sending are one
 * piece of code. The three owner toggles (form, availability, services) are
 * honoured exactly as the Classic page honours them.
 */
function Page() {
  const { data: identity } = useGetSiteIdentityQuery();
  const ref = useRef<HTMLElement>(null);
  useScene(ref, headingScene);

  const toggles = identity?.profile_data.contact_page;
  const showForm = toggles?.show_contact_form ?? true;
  const showBadge = toggles?.show_availability_badge ?? true;
  const showServices = toggles?.show_services ?? true;

  // Only links that are visible and have a usable address: a link dropped
  // here must not still count towards "are there any".
  const socials = (identity?.social_links ?? [])
    .filter((social) => social.is_visible)
    .map((social) => ({ ...social, href: safeLinkUrl(social.url) }))
    .filter((social): social is typeof social & { href: string } =>
      Boolean(social.href),
    );
  const hasSocials = socials.length > 0;

  return (
    <>
      <header
        ref={ref}
        data-part="opening"
        className="flex min-h-[60svh] flex-col justify-end gap-8 overflow-hidden px-[var(--band-x)] pb-12 pt-10 max-[399px]:px-4"
      >
        <h1
          data-line
          className="im-display im-display-xl will-change-transform"
        >
          {siteContent.pages.contact.heading}
        </h1>
        <p className="t-lead max-w-prose text-pretty">
          {siteContent.pages.contact.subheading}
        </p>
        {showBadge && (
          <p className="im-mono inline-flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-success"
            />
            {identity?.profile_data.status_panel.availability ||
              "Available for work"}
          </p>
        )}
      </header>

      {(showForm || hasSocials) && (
        <div
          data-part="ways"
          className={cn(
            "im-rule grid items-start gap-12 px-[var(--band-x)] py-16 max-[399px]:px-4",
            showForm &&
              hasSocials &&
              "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
          )}
        >
          {showForm && (
            <section
              aria-label="Contact form"
              className="im-panel min-w-0 p-6 sm:p-8"
            >
              <h2 className="im-display text-2xl !leading-tight !normal-case">
                Send a message
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Every message is read by a person.
              </p>
              <div className="mt-6">
                <ContactForm />
              </div>
            </section>
          )}

          {hasSocials && (
            <aside className="min-w-0">
              <h2 id="im-direct-lines" className="im-mono">
                Direct lines
              </h2>
              <ul aria-labelledby="im-direct-lines" className="mt-4">
                {socials.map((social) => (
                  <li key={social.id}>
                    <Rule />
                    <a
                      href={social.href}
                      {...(isInternalUrl(social.href) ||
                      social.href.startsWith("mailto:") ||
                      social.href.startsWith("tel:")
                        ? {}
                        : { target: "_blank", rel: "noopener noreferrer" })}
                      className="group flex min-h-11 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-control py-4 focus-ring"
                    >
                      <span className="text-lg font-medium text-foreground decoration-primary decoration-2 underline-offset-4 group-hover:underline">
                        {social.label}
                      </span>
                      <span className="im-mono !normal-case !tracking-normal">
                        {channelDestination(social.href)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}

      {showServices && (
        <div className="im-rule px-[var(--band-x)] py-20 empty:hidden max-[399px]:px-4">
          <DynamicPageContent pagePath="/contact" />
        </div>
      )}
    </>
  );
}

/*
  The page is rendered inside the provider, not around it: `useScene` reads
  the provider's context, so a component that called the hook and then
  rendered the provider as its own child would never get a scene.
*/
export default function ImmersiveContact() {
  return (
    <WithScroll>
      <Page />
    </WithScroll>
  );
}
