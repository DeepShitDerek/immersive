import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PagesHarness } from "@/features/content/pages-harness";

/**
 * Dev-only harness for the Pages editor's section detail and settings sheet,
 * without a sign-in. Exists only in builds made with NEXT_PUBLIC_DEV_HARNESS=1;
 * every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Pages harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <PagesHarness />;
}
