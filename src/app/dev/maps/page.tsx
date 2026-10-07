import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapsHarness } from "@/features/maps/ui/maps-harness";

/**
 * Dev-only harness for the Maps editor: the real editor against
 * local storage instead of Supabase, so it can be exercised in a browser
 * without an admin login. Exists only in builds made with
 * NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Maps harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <MapsHarness />;
}
