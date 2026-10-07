import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InboxHarness } from "@/features/inbox/inbox-harness";

/**
 * Dev-only harness for the Inbox, without a sign-in. Exists only in builds
 * made with NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Inbox harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  // The open message is in the URL; under static export that needs Suspense.
  return (
    <Suspense>
      <InboxHarness />
    </Suspense>
  );
}
