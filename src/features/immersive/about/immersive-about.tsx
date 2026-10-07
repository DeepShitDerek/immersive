"use client";

import { useRef } from "react";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import { DynamicPageContent } from "@/features/sections/dynamic-page-content";
import { Markdown } from "@/components/ui/markdown";
import { sizedImageUrl } from "@/lib/image-size";
import { useScene, type Scene } from "../motion/scroll-provider";
import { WithScroll } from "../shared/ruled";
import { words } from "../home/home-model";
import { Proof } from "../home/proof";
import { Now } from "../home/now";
import { aboutParts } from "./about-model";

/** Unlit words are dimmed, never hidden. */
const DIM = 0.28;

/** The lead lights up word by word as it comes into view. Nothing is held. */
function leadScene({ gsap, el }: Scene) {
  gsap.fromTo(
    el.querySelectorAll("[data-word]"),
    { opacity: DIM },
    {
      opacity: 1,
      ease: "none",
      stagger: 0.1,
      scrollTrigger: {
        trigger: el,
        // Clamped to what the page can scroll: on a short page the end would
        // otherwise be out of reach and leave the last words dimmed.
        start: "clamp(top 85%)",
        end: "clamp(top 35%)",
        scrub: true,
      },
    },
  );
}

/**
 * About in an immersive style: the name set large, the first bio paragraph as
 * a lead, the rest at reading width, then the figures, the status and the
 * owner's own sections.
 */
function Page() {
  const { data: identity } = useGetSiteIdentityQuery();
  const leadRef = useRef<HTMLElement>(null);
  useScene(leadRef, leadScene);

  if (!identity) return null;
  const parts = aboutParts(identity);

  return (
    <>
      <header
        data-part="opening"
        className="flex min-h-[70svh] flex-col justify-between gap-10 px-[var(--band-x)] pb-8 pt-10 max-[399px]:px-4"
      >
        <p className="im-mono min-h-6">{parts.role}</p>
        <h1 className="im-display im-display-xl">{parts.name}</h1>
        <div className="flex min-h-6 items-end">
          {parts.picture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sizedImageUrl(parts.picture, 224)}
              alt={parts.name}
              className="size-24 rounded-surface border border-border object-cover sm:size-32"
            />
          )}
        </div>
      </header>

      {parts.lead && (
        <section
          ref={leadRef}
          data-part="lead"
          className="im-rule px-[var(--band-x)] py-20 max-[399px]:px-4 md:py-28"
        >
          <p className="im-display im-display-md max-w-[28ch] !normal-case">
            {words(parts.lead).map((word, index) => (
              <span key={`${index}-${word}`}>
                <span data-word>{word}</span>{" "}
              </span>
            ))}
          </p>
        </section>
      )}

      {parts.rest.length > 0 && (
        <section
          data-part="bio"
          className="px-[var(--band-x)] pb-20 max-[399px]:px-4 md:pb-28"
        >
          <div className="max-w-prose space-y-5">
            {parts.rest.map((paragraph, index) => (
              <Markdown
                key={index}
                className="max-w-none text-base leading-relaxed text-muted-foreground [&_strong]:text-foreground"
              >
                {paragraph}
              </Markdown>
            ))}
          </div>
        </section>
      )}

      {parts.proof && <Proof items={identity.profile_data.proof} />}
      {parts.now && <Now status={identity.profile_data.status_panel} />}

      <div className="im-rule px-[var(--band-x)] py-20 empty:hidden max-[399px]:px-4">
        <DynamicPageContent pagePath="/about" />
      </div>
    </>
  );
}

/*
  The page is rendered inside the provider, not around it: `useScene` reads
  the provider's context, so a component that called the hook and then
  rendered the provider as its own child would never get a scene.
*/
export default function ImmersiveAbout() {
  return (
    <WithScroll>
      <Page />
    </WithScroll>
  );
}
