"use client";

import { useEffect, useState } from "react";
import {
  currentExcalidrawTheme,
  type ExcalidrawTheme,
} from "./whiteboard-theme";

/**
 * Tracks the app theme so the canvas flips with it. Themes are applied by
 * swapping a class on <html> (see `use-theme-sync`), so a class observer is
 * the only signal available — there is no event to listen for.
 */
export function useExcalidrawTheme(): ExcalidrawTheme {
  const [theme, setTheme] = useState<ExcalidrawTheme>("light");

  useEffect(() => {
    const sync = () => setTheme(currentExcalidrawTheme());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
