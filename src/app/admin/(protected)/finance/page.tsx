"use client";

import { Suspense } from "react";
import MoneyPage from "@/features/money/ui/money-page";

/**
 * The money module. Needs the `money_*` tables from
 * db/schema.sql; without them the page says so rather than showing empty
 * screens. The area lives in the query string, which needs Suspense.
 */
export default function Page() {
  return (
    <Suspense>
      <MoneyPage />
    </Suspense>
  );
}
