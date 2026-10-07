import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsHarness } from "@/features/settings/settings-harness";

/**
 * Dev-only harness for the Settings screen, without a sign-in. Exists only
 * in builds made with NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Settings harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <SettingsHarness />;
}
