"use client";

import { Band } from "@/components/layout/band";
import { PageHeader } from "@/components/layout/page-header";
import { DynamicPageContent } from "./dynamic-page-content";

/**
 * An admin-created page: nav-link title + its CMS sections.
 *
 * The kicker previously printed the raw `page_path`, so a visitor to
 * /projects/case-studies/ledgerline saw the full slug above the title. It now
 * renders as a breadcrumb-ish trail, and the long-path case wraps instead of
 * pushing the header wider than the container.
 */
export function CmsPage({
  pagePath,
  title,
}: {
  pagePath: string;
  title: string;
}) {
  const kicker =
    pagePath === "/" ? "home" : pagePath.split("/").filter(Boolean).join(" / ");

  return (
    <Band weight="content">
      <PageHeader kicker={kicker} title={title} />
      <DynamicPageContent pagePath={pagePath} className="mt-12 sm:mt-16" />
    </Band>
  );
}
