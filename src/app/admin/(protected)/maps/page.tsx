"use client";

import { Suspense } from "react";
import MapsPage from "@/features/maps/ui/maps-page";

// useSearchParams (the open map, ?map=) needs a Suspense boundary under
// static export. Admin pages are client-rendered anyway.
export default function Page() {
  return (
    <Suspense>
      <MapsPage />
    </Suspense>
  );
}
