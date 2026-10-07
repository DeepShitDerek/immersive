import { Instrument_Serif, Inter_Tight } from "next/font/google";

/**
 * The immersive styles' faces, self-hosted by next/font at build time like
 * Caveat (providers.tsx): no request to Google at run time.
 *
 * `preload: false` matters: this module is reachable from the public chrome,
 * so a preload would make Classic visitors download two faces they never see.
 * Without it the browser fetches a face only when text is set in it.
 */
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
  preload: false,
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
  preload: false,
});

export const immersiveFontVars = `${interTight.variable} ${instrumentSerif.variable}`;
