/**
 * Every family the typography presets use, in one Google Fonts request.
 *
 * Loaded two ways, deliberately:
 * - Production: the `@import` at the top of styles/globals.css (the same URL).
 *   Measured against a <link> in <head>, the import gave the blog post an LCP
 *   of 4.9–5.0 s against 5.5–5.6 s, two runs each.
 * - Development: a <link> from the root layout, because the dev server
 *   (Turbopack) drops a remote @import from CSS entirely, and every preset
 *   rendered in the system sans-serif.
 *
 * Newsreader (Field Notes' heading face) is requested by weight only. With
 * its italic and optical-size axes it was the heaviest file here, and the
 * default typography paid for it: Lighthouse FCP and LCP were 0.4–0.5 s
 * better without them. Headings are not set in
 * italic, and prose uses the body face.
 *
 * styles/typography.test.ts keeps the two URLs identical and checks every
 * preset family is in it.
 */
export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700..800&family=Chivo:wght@400;500;700&family=DM+Sans:wght@400;500;700&family=Fira+Code:wght@400;500&family=Fraunces:opsz,wght@9..144,600..900&family=Geist:wght@400..800&family=Geist+Mono:wght@400;500&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400..700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400..700&family=JetBrains+Mono:wght@400;500;700&family=Libre+Baskerville:wght@400;700&family=Lora:ital,wght@0,400..600;1,400..600&family=Manrope:wght@400..700&family=Onest:wght@400..800&family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400..700&family=Sora:wght@400..600&family=Space+Grotesk:wght@500;700&family=Unbounded:wght@600;700&family=Figtree:wght@400..700&family=Funnel+Display:wght@400..800&family=Funnel+Sans:ital,wght@0,400..700;1,400..700&family=Newsreader:wght@400..700&display=swap";
