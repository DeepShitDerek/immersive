"use client";

import { useSearchParams } from "next/navigation";
import { PostPage } from "@/features/blog/post-page";
import { StyleSwitch } from "../style-switch";

/** /blog/view/?slug= in either style. Rendered inside the route's Suspense. */
export function PostSwitchFromQuery() {
  const slug = useSearchParams()?.get("slug") ?? "";
  return (
    <StyleSwitch layout="post" slug={slug} classic={<PostPage slug={slug} />} />
  );
}
