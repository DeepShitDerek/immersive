"use client";

import { useRef, type CSSProperties } from "react";
import Link from "next/link";
import { Markdown } from "@/features/sections/shared";
import { useScene, type Scene } from "../motion/scroll-provider";
import { words } from "./home-model";

/** Unlit words are dimmed, never hidden: 0.28 keeps them readable. */
const DIM = 0.28;

const TRACK = { "--im-track": "220vh" } as CSSProperties;

function statementScene({ gsap, el, pin }: Scene) {
  gsap.fromTo(
    el.querySelectorAll("[data-word]"),
    { opacity: DIM },
    {
      opacity: 1,
      ease: "none",
      stagger: 0.1,
      scrollTrigger: pin
        ? { trigger: el, start: "top top", end: "bottom bottom", scrub: true }
        : { trigger: el, start: "top 80%", end: "bottom 60%", scrub: true },
    },
  );
}

/**
 * Beat 2: the screen holds while the headline lights up word by word.
 * The hold is CSS (`.im-pin` inside a tall `.im-pin-track`); on a phone or
 * with reduced motion the track is its natural height and nothing holds.
 */
export function Statement({
  headline,
  bio,
}: {
  headline: string;
  bio: string[];
}) {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, statementScene);

  return (
    <section
      ref={ref}
      data-beat="statement"
      className="im-pin-track im-rule"
      style={TRACK}
    >
      <div className="im-pin im-pin-box flex flex-col justify-center gap-8 px-[var(--band-x)] py-20 max-[399px]:px-4">
        <h2 className="im-display im-display-md max-w-[22ch] !normal-case">
          {words(headline).map((word, index) => (
            <span key={`${word}-${index}`}>
              <span data-word>{word}</span>{" "}
            </span>
          ))}
        </h2>
        {bio.length > 0 && (
          <div className="max-w-prose space-y-3 text-muted-foreground">
            {bio.slice(0, 2).map((paragraph) => (
              <Markdown key={paragraph} className="text-base">
                {paragraph}
              </Markdown>
            ))}
          </div>
        )}
        <p>
          <Link
            href="/about/"
            className="im-mono inline-flex min-h-6 items-center rounded-control text-foreground underline decoration-primary underline-offset-4 focus-ring"
          >
            About
          </Link>
        </p>
      </div>
    </section>
  );
}
