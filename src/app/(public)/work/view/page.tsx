import type { Metadata } from "next";
import { Suspense } from "react";
import { CaseStudySwitchFromQuery } from "@/features/immersive/case-study/from-query";

export const metadata: Metadata = {
  title: "Case study",
};

export default function Page() {
  // Slug arrives as ?slug= (static-export-friendly); useSearchParams requires
  // a Suspense boundary.
  return (
    <Suspense>
      <CaseStudySwitchFromQuery />
    </Suspense>
  );
}
