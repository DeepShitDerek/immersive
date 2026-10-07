"use client";

import { useCallback, useEffect, useState } from "react";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import {
  applySiteTheme,
  resolveThemeClass,
  writeVisitorScheme,
  type Scheme,
} from "@/lib/themes";

/**
 * The scheme on screen, and a way to ask for the other one.
 *
 * `scheme` is read from the `dark` class, so it is whatever is actually
 * painted — the owner's theme, a visitor's choice, or a custom palette — and
 * it is null until mounted, because the server cannot know it: a control
 * rendered from a guess would hydrate wrong for half the visitors.
 */
export function useColorScheme(): {
  scheme: Scheme | null;
  setScheme: (scheme: Scheme) => void;
} {
  const { data: identity } = useGetSiteIdentityQuery();
  const [scheme, setCurrent] = useState<Scheme | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const read = () =>
      setCurrent(html.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const setScheme = useCallback(
    (next: Scheme) => {
      writeVisitorScheme(next);
      const profile = identity?.profile_data;
      applySiteTheme(
        resolveThemeClass(profile?.default_theme),
        profile?.typography_preset || "typo-default",
        profile?.custom_theme_colors,
        next,
      );
    },
    [identity],
  );

  return { scheme, setScheme };
}
