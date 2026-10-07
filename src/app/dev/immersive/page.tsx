import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImmersiveHarness } from "@/features/immersive/immersive-harness";

/**
 * Dev-only harness for the immersive layouts, with placeholder content.
 * Exists only in builds made with NEXT_PUBLIC_DEV_HARNESS=1; every other
 * build answers 404.
 */
export const metadata: Metadata = {
  title: "Immersive harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <ImmersiveHarness />;
}
