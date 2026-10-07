import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogEditorHarness } from "@/features/blog-admin/blog-editor-harness";

/**
 * Dev-only harness for the blog editor in the workspace frame (launcher
 * layout), without a sign-in. Exists only in builds made with
 * NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Blog editor harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  return <BlogEditorHarness />;
}
