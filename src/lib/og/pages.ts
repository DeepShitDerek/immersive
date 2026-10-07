import { config as appConfig } from "@/lib/config";
import { siteContent } from "@/lib/site-content";
import portfolioConfig from "../../../portfolio.config";
import type { OgCard } from "./card";

/**
 * One preview card per top-level public page. The keys are the
 * image paths: /og/page/<key>/image.png.
 */
export const OG_PAGES = {
  // The same order as the home hero: role, headline, then the longer line.
  home: {
    eyebrow: portfolioConfig.title || "Portfolio",
    title: portfolioConfig.headline || portfolioConfig.name,
    description: appConfig.site.description,
  },
  work: {
    eyebrow: "Work",
    title: siteContent.pages.work.subheading,
    description: siteContent.pages.work.description,
  },
  about: {
    eyebrow: "About",
    title: siteContent.pages.about.description,
  },
  blog: {
    eyebrow: "Writing",
    title: siteContent.pages.blog.description,
  },
  contact: {
    eyebrow: "Work with me",
    title: siteContent.pages.contact.subheading,
  },
  updates: {
    eyebrow: "Updates",
    title:
      "Milestones, experiments, and current activity — a living feed of what I'm working on.",
  },
} satisfies Record<string, OgCard>;

export type OgPageKey = keyof typeof OG_PAGES;

export function ogPageImage(key: OgPageKey): string {
  return `/og/page/${key}/image.png`;
}
