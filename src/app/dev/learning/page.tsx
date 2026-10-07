import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LearningHarness } from "@/features/learning/learning-harness";

/**
 * Dev-only harness for the Learning screen, without a sign-in. Exists only
 * in builds made with NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Learning harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <LearningHarness />;
}
