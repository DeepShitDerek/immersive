"use client";

import { useRef } from "react";
import type { SiteContent } from "@/types";
import { useScene, type Scene } from "../motion/scroll-provider";
import { words } from "./home-model";

/** On scroll the words drift apart and up. They start where they are read. */
function openingScene({ gsap, el }: Scene) {
  gsap.to(el.querySelectorAll("[data-word]"), {
    xPercent: (index: number) => (index % 2 === 0 ? -6 : 6),
    yPercent: -40,
    opacity: 0.15,
    ease: "none",
    stagger: 0.03,
    scrollTrigger: {
      trigger: el,
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });
}

/**
 * Beat 1: the name and role fill the screen.
 *
 * The heading moves by the word, not the letter: a heading cut into letter
 * boxes cannot be found with the browser's find-in-page.
 */
export function Opening({ identity }: { identity: SiteContent }) {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, openingScene);
  const { name, title, status_panel: status } = identity.profile_data;
  const role = title?.trim();
  const heading = role || name;

  return (
    <section
      ref={ref}
      data-beat="opening"
      className="flex min-h-[calc(100svh-3.5rem)] flex-col justify-between gap-10 overflow-hidden px-[var(--band-x)] pb-8 pt-10 max-[399px]:px-4"
    >
      <p className="im-mono min-h-6">{role ? name : ""}</p>
      <h1 className="im-display im-display-xl">
        {words(heading).map((word, index) => (
          <span key={`${word}-${index}`}>
            <span data-word className="inline-block will-change-transform">
              {word}
            </span>{" "}
          </span>
        ))}
      </h1>
      <p className="im-mono flex min-h-6 items-center gap-2">
        {status?.show && status.availability && (
          <>
            <span aria-hidden className="size-2 rounded-full bg-primary" />
            {status.availability}
          </>
        )}
      </p>
    </section>
  );
}
