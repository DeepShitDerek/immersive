"use client";

import React from "react";
import dynamic from "next/dynamic";
import { isImmersive, resolveSiteStyle } from "@/lib/site-style";
import { Caveat } from "next/font/google";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { Provider } from "react-redux";
import { store } from "@/store/store";
import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import {
  VALID_THEMES,
  THEME_STORAGE_KEY,
  resolveThemeClass,
} from "@/lib/themes";
import { useThemeSync } from "@/hooks/use-theme-sync";
import { watchDarkClass } from "@/lib/themes";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/providers/confirm-dialog-provider";
import {
  useSeedPublicCache,
  type PublicPreloadData,
} from "@/store/public-preload";

/**
 * The handwriting face for Updates. Self-hosted by next/font at build time, so
 * the static export serves it from the site's own origin with no request to
 * Google at runtime. It replaced Tahu, which nothing uses any more.
 */
const caveatFont = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

/**
 * The owner's site style on the document, when it is not Classic. Rendered at
 * build too (the identity is in the cache by then), so the first paint is in
 * the style.
 */
const SiteStyleDocument = dynamic(() =>
  import("@/features/immersive/shell/document-style").then(
    (mod) => mod.SiteStyleDocument,
  ),
);
function SiteStyle() {
  const { data } = useGetSiteIdentityQuery();
  return isImmersive(resolveSiteStyle(data?.profile_data?.site_style)) ? (
    <SiteStyleDocument />
  ) : null;
}

/** Keeps `dark` on <html> matching the active theme, however it was set. */
function DarkClassSync() {
  React.useEffect(() => watchDarkClass(), []);
  return null;
}

/** Owner-selected theme/typography from site_identity, applied to <html>. */
function ThemeSync({ children }: { children: React.ReactNode }) {
  const { data: siteIdentity } = useGetSiteIdentityQuery();
  useThemeSync(siteIdentity);
  return <>{children}</>;
}

/**
 * Writes the build-time site data into the cache before anything below reads
 * it — the header, footer and theme all do — then revalidates once mounted.
 */
function SeedSiteData({
  data,
  children,
}: {
  data: PublicPreloadData | undefined;
  children: React.ReactNode;
}) {
  useSeedPublicCache(data);
  return <>{children}</>;
}

export function Providers({
  children,
  preload,
}: {
  children: React.ReactNode;
  preload?: PublicPreloadData;
}) {
  // The owner's theme as of the build, so a first visit paints in it rather
  // than in the default preset and then switching once site_identity loads.
  const buildTheme = resolveThemeClass(
    preload?.siteIdentity?.profile_data?.default_theme,
  );

  return (
    <Provider store={store}>
      <SeedSiteData data={preload}>
        <ThemeProvider
          attribute="class"
          defaultTheme={buildTheme}
          enableSystem={false}
          storageKey={THEME_STORAGE_KEY}
          themes={VALID_THEMES}
        >
          {/* Honors the OS "reduce motion" setting for every framer-motion animation. */}
          <MotionConfig reducedMotion="user">
            <ConfirmDialogProvider>
              <DarkClassSync />
              {/* Noir, Paper or Dusk: the whole app takes the style, the
                  workspace included. A lazy chunk, so a Classic site carries
                  none of it. */}
              <SiteStyle />
              <ThemeSync>
                {/* Font-variable carrier only — page landmarks live in the route layouts.
                    Admin-only globals (command palette, learning-session timer)
                    live in AdminShell, so visitors never load them. */}
                <div className={caveatFont.variable}>
                  {children}
                  <SonnerToaster />
                </div>
              </ThemeSync>
            </ConfirmDialogProvider>
          </MotionConfig>
        </ThemeProvider>
      </SeedSiteData>
    </Provider>
  );
}
