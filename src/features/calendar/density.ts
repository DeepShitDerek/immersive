"use client";

import { useEffect, useState } from "react";

/**
 * How tall an hour is in the time grid, remembered per browser.
 *
 * "Fit" (squeezing the working hours into the screen) went with the rebuild:
 * the grid scrolls through the whole day now, so an hour always has a real,
 * readable height and an early flight is still on the calendar.
 */
export type Density = "compact" | "comfortable" | "spacious";

export const HOUR_HEIGHT: Record<Density, number> = {
  compact: 40,
  comfortable: 56,
  spacious: 80,
};

export const DENSITY_OPTIONS: { id: Density; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious", label: "Spacious" },
];

const STORAGE_KEY = "calendarDensity";
const DEFAULT: Density = "comfortable";

function isDensity(value: unknown): value is Density {
  return DENSITY_OPTIONS.some((option) => option.id === value);
}

function readStored(): Density {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // An old "fit" (or anything unknown) falls back to the default.
    if (isDensity(stored)) return stored;
  } catch {
    // Storage can be unavailable in private mode; the default is fine.
  }
  return DEFAULT;
}

export function useDensity(): [Density, (next: Density) => void] {
  // Starts at the default so the first render matches the static markup;
  // the stored value is applied after mount.
  const [density, setDensity] = useState<Density>(DEFAULT);

  useEffect(() => {
    setDensity(readStored());
  }, []);

  const update = (next: Density) => {
    setDensity(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort.
    }
  };

  return [density, update];
}
