import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DiscoverPage from "@/features/discover/discover-page";

/**
 * Dev-only harness for Discover: the real page, without a sign-in. With no
 * database the places and topics fall back to defaults; every live source is
 * real. Exists only in builds made with NEXT_PUBLIC_DEV_HARNESS=1.
 */
export const metadata: Metadata = {
  title: "Discover harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return (
    <Suspense>
      <div className="mx-auto max-w-wide p-6">
        <DiscoverPage />
      </div>
    </Suspense>
  );
}
