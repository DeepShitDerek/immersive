"use client";

import { useRef } from "react";
import type { SiteContent } from "@/types";
import { useScene, type Scene } from "../motion/scroll-provider";

/** The figures slide in from the side. The numbers themselves never change. */
function proofScene({ gsap, el, motion }: Scene) {
  gsap.from(el.querySelectorAll("[data-figure]"), {
    xPercent: 25,
    opacity: 0.3,
    duration: motion.duration,
    ease: motion.ease,
    stagger: motion.stagger,
    scrollTrigger: { trigger: el, start: "top 75%" },
  });
}

/** Beat 3: the owner's figures, set very large. */
export function Proof({
  items,
}: {
  items: SiteContent["profile_data"]["proof"];
}) {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, proofScene);

  return (
    <section
      ref={ref}
      data-beat="proof"
      className="im-rule overflow-hidden px-[var(--band-x)] py-20 max-[399px]:px-4 md:py-32"
    >
      <dl className="grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <div
            key={`${index}-${item.label}`}
            data-figure
            className="flex flex-col-reverse gap-3"
          >
            <dt className="im-mono">{item.label}</dt>
            <dd className="im-display im-display-lg">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
