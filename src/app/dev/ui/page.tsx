import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StateMatrix } from "@/features/design-system/state-matrix";

/**
 * Dev-only component state matrix. Exists only in builds made with
 * NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Component states",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <StateMatrix />;
}
