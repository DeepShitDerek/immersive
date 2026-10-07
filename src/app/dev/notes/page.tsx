import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotesHarness } from "@/features/notes/notes-harness";

/**
 * Dev-only harness for the Notes layout: exists only in builds made with
 * NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Notes harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <NotesHarness />;
}
