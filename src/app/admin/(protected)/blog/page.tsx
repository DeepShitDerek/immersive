"use client";

import { Suspense } from "react";
import BlogAdminPage from "@/features/blog-admin/blog-admin-page";

// The open item lives in the query string; useSearchParams needs a
// Suspense boundary under static export.
export default function Page() {
  return (
    <Suspense>
      <BlogAdminPage />
    </Suspense>
  );
}
