import "@/styles/globals.css";
import "@/styles/themes.css";
import "@/styles/typography.css";
import "prism-themes/themes/prism-one-dark.css";
import { GOOGLE_FONTS_URL } from "@/lib/google-fonts";
import type { Metadata, Viewport } from "next";
import { config as appConfig } from "@/lib/config";
import {
  fetchNavLinks,
  fetchSiteIdentity,
  orUndefined,
} from "@/lib/public-data";
import { resolveSiteStyle } from "@/lib/site-style";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: appConfig.site.title,
    template: `%s | ${appConfig.site.author}`,
  },
  description: appConfig.site.description,
  metadataBase: new URL(appConfig.site.url),
};

export const viewport: Viewport = {
  // The default preset's ground; applyTheme retints it for the active theme.
  themeColor: "#f8f6f1",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Site-wide data, read once at build and rendered into every page's HTML
  //. The browser revalidates it after hydration.
  const [siteIdentity, navLinks] = await Promise.all([
    orUndefined(fetchSiteIdentity()),
    orUndefined(fetchNavLinks()),
  ]);

  // No `scroll-smooth` class on <html>: globals.css applies smooth scrolling
  // only without prefers-reduced-motion, and the class overrode that
  // for everyone.
  return (
    <html
      lang="en"
      data-style={resolveSiteStyle(siteIdentity?.profile_data?.site_style)}
      suppressHydrationWarning
    >
      <head>
        {/* Development only: the dev server drops the font @import from
            globals.css, which production keeps (lib/google-fonts.ts). */}
        {process.env.NODE_ENV === "development" && (
          <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
        )}
      </head>
      <body>
        <Providers preload={{ siteIdentity, navLinks }}>{children}</Providers>
      </body>
    </html>
  );
}
