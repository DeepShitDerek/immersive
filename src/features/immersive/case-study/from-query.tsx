"use client";

import { useSearchParams } from "next/navigation";
import { CaseStudyPage } from "@/features/work/case-study-page";
import { StyleSwitch } from "../style-switch";

/** /work/view/?slug= in either style. Rendered inside the route's Suspense. */
export function CaseStudySwitchFromQuery() {
  const slug = useSearchParams()?.get("slug") ?? "";
  return (
    <StyleSwitch
      layout="case-study"
      slug={slug}
      classic={<CaseStudyPage slug={slug} />}
    />
  );
}
