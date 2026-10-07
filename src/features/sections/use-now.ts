"use client";

import { useEffect, useState } from "react";

/**
 * The visitor's clock, read after mount; null until then.
 *
 * The public pages are statically exported, so anything relative to "now"
 * — the length of a job still in progress — would otherwise be computed on
 * the day of the build, and would not match on hydration.
 */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}
