"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { PrerenderedBody } from "@/features/blog/use-post-page";
import { isImmersive } from "@/lib/site-style";
import { useSiteStyle } from "./styles/use-site-style";

/*
  Dynamic, so a Classic visitor's bundle holds the switch and nothing behind
  it. Still rendered at build: next/dynamic server-renders by default, so the
  static HTML of an immersive site contains the immersive page.
*/
const ImmersiveHome = dynamic(() => import("./home/immersive-home"));
const ImmersiveWork = dynamic(() => import("./work/immersive-work"));
const ImmersiveBlog = dynamic(() => import("./blog/immersive-blog"));
const ImmersivePost = dynamic(() => import("./blog/immersive-post"));
const ImmersiveUpdates = dynamic(() => import("./updates/immersive-updates"));
const ImmersiveAbout = dynamic(() => import("./about/immersive-about"));
const ImmersiveContact = dynamic(() => import("./contact/immersive-contact"));
const ImmersiveCaseStudy = dynamic(
  () => import("./case-study/immersive-case-study"),
);

/**
 * Picks the Classic page or the immersive layout for a route. Removing the
 * immersive feature is deleting this folder, the three places this is used,
 * and the setting.
 */
export function StyleSwitch({
  layout,
  classic,
  builtSlugs,
  slug,
  prerendered,
}: {
  layout:
    | "home"
    | "work"
    | "case-study"
    | "blog"
    | "post"
    | "updates"
    | "about"
    | "contact";
  classic: ReactNode;
  builtSlugs?: readonly string[];
  slug?: string;
  /** A post's build-time body, handed to whichever version renders. */
  prerendered?: PrerenderedBody;
}) {
  const style = useSiteStyle();
  if (!isImmersive(style)) return <>{classic}</>;
  if (layout === "home") return <ImmersiveHome builtSlugs={builtSlugs} />;
  if (layout === "work") return <ImmersiveWork />;
  if (layout === "contact") return <ImmersiveContact />;
  if (layout === "about") return <ImmersiveAbout />;
  if (layout === "updates") return <ImmersiveUpdates />;
  if (layout === "blog") return <ImmersiveBlog builtSlugs={builtSlugs} />;
  if (layout === "post")
    return (
      <ImmersivePost
        slug={slug ?? ""}
        prerendered={prerendered}
        builtSlugs={builtSlugs}
      />
    );
  return <ImmersiveCaseStudy slug={slug ?? ""} />;
}
