import type { Metadata } from "next";
import { socialMetadata } from "@/lib/og/metadata";
import { ogPageImage } from "@/lib/og/pages";
import { siteContent } from "@/lib/site-content";
import { Band } from "@/components/layout/band";
import { PageHeader } from "@/components/layout/page-header";
import { DynamicPageContent } from "@/features/sections/dynamic-page-content";
import { RepoGrid } from "@/features/github/repo-grid";
import { pagePreload } from "@/lib/public-preload-server";
import { PublicPreload } from "@/store/public-preload";
import { StyleSwitch } from "@/features/immersive/style-switch";

export const metadata: Metadata = {
  title: siteContent.pages.work.title,
  description: siteContent.pages.work.description,
  ...socialMetadata({
    title: siteContent.pages.work.title,
    description: siteContent.pages.work.description,
    path: "/work/",
    image: ogPageImage("work"),
  }),
};

/**
 * /work — one answer to "what have you built?".
 *
 * Its own sections (case studies, then projects, in the order set in
 * Content), then open source. /showcase and /projects no longer exist; their
 * sections were moved here.
 */
export default async function Page() {
  const data = await pagePreload({ sections: ["/work"] });
  return (
    <PublicPreload data={data}>
      <StyleSwitch layout="work" classic={<ClassicWork />} />
    </PublicPreload>
  );
}

/** Today's page, unchanged: what Classic shows. */
function ClassicWork() {
  return (
    <>
      <Band weight="content">
        <PageHeader
          kicker="Portfolio"
          title={siteContent.pages.work.heading}
          subheading={siteContent.pages.work.subheading}
        />
        <DynamicPageContent pagePath="/work" />
      </Band>
      <Band weight="content" aria-labelledby="repos-heading">
        <h2 id="repos-heading" className="t-title">
          Open source &amp; experiments
        </h2>
        <div className="mt-8">
          <RepoGrid />
        </div>
      </Band>
    </>
  );
}
