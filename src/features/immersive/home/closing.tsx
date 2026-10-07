"use client";

import { useRef } from "react";
import Link from "next/link";
import type { SiteContent } from "@/types";
import { useGetNavLinksQuery } from "@/store/api/publicApi";
import { CTA_HREF, splitNav } from "@/components/layout/nav-links";
import { isInternalUrl, safeLinkUrl } from "@/lib/safe-url";
import { useScene, type Scene } from "../motion/scroll-provider";
import { emailOf } from "./home-model";

/** The line grows into place as the page ends. */
function closingScene({ gsap, el }: Scene) {
  gsap.from(el.querySelector("[data-line]"), {
    scale: 0.82,
    transformOrigin: "left bottom",
    ease: "none",
    scrollTrigger: {
      trigger: el,
      start: "top bottom",
      end: "bottom bottom",
      scrub: true,
    },
  });
}

const LINK =
  "im-mono inline-flex min-h-6 items-center rounded-control transition-colors duration-fast hover:text-foreground focus-ring";

/**
 * Beat 7: one very large line, the email, the links.
 *
 * The line is the owner's own call to action from Navigation (the label the
 * header uses), so no sentence here is written by the template.
 */
export function Closing({ identity }: { identity: SiteContent }) {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, closingScene);
  const { data: navLinks } = useGetNavLinksQuery();
  const { cta } = splitNav(navLinks ?? []);
  const email = emailOf(identity);
  const socials = identity.social_links
    .filter(
      (social) => social.is_visible && social.id.toLowerCase() !== "email",
    )
    .map((social) => ({ ...social, href: safeLinkUrl(social.url) }))
    .filter((social): social is typeof social & { href: string } =>
      Boolean(social.href),
    );

  return (
    <section
      ref={ref}
      data-beat="closing"
      aria-labelledby="im-closing-heading"
      className="im-rule flex min-h-[80svh] flex-col justify-end gap-10 overflow-hidden px-[var(--band-x)] py-16 max-[399px]:px-4"
    >
      <h2
        id="im-closing-heading"
        data-line
        className="im-display im-display-xl will-change-transform"
      >
        <Link
          href={cta?.href ?? CTA_HREF}
          className="rounded-control decoration-primary decoration-4 underline-offset-[0.12em] hover:underline focus-ring"
        >
          {cta?.label ?? "Contact"}
        </Link>
      </h2>
      {(email || socials.length > 0) && (
        <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {email && (
            <li>
              <a
                href={email}
                className={`${LINK} !normal-case !tracking-normal text-foreground`}
              >
                {email.replace(/^mailto:/, "")}
              </a>
            </li>
          )}
          {socials.map((social) => (
            <li key={social.url}>
              <a
                href={social.href}
                className={LINK}
                {...(isInternalUrl(social.href)
                  ? {}
                  : { target: "_blank", rel: "noopener noreferrer" })}
              >
                {social.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
