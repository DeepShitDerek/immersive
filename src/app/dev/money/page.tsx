import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MoneyHarness } from "@/features/money/ui/money-harness";

/**
 * Dev-only harness for the money module: the real screens against
 * an in-memory ledger instead of Supabase. Exists only in builds made with
 * NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Money harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <MoneyHarness />;
}
