/**
 * Browser, OS and device from a user-agent string.
 *
 * Hand-rolled rather than `ua-parser-js`, which is ~20 kB minified. This runs
 * on every public page view, so it lands in the shared bundle — the whole point
 * of the module is measuring the site, not slowing it down. What is here covers
 * the browsers a portfolio actually sees; anything else is reported as
 * "Other", which is honest and does not pretend to a precision the strings do
 * not support anyway.
 *
 * Order matters throughout. Every Chromium browser claims to be Chrome, Chrome
 * claims to be Safari, and Safari claims to be Mozilla — so the most specific
 * match has to be tested first.
 */

type DeviceKind = "desktop" | "mobile" | "tablet";

export interface AgentSummary {
  browser: string;
  os: string;
  device: DeviceKind;
}

const BROWSERS: [RegExp, string][] = [
  // Chromium derivatives, before Chrome — all of them include "Chrome".
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\//, "Opera"],
  [/\bVivaldi\//, "Vivaldi"],
  [/\bBrave\//, "Brave"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bYaBrowser\//, "Yandex"],
  [/\bDuckDuckGo\//, "DuckDuckGo"],
  [/\bCriOS\//, "Chrome"],
  [/\bFxiOS\//, "Firefox"],
  [/\bChrome\//, "Chrome"],
  [/\bFirefox\/|\bSeaMonkey\//, "Firefox"],
  // Safari last: every WebKit browser carries the token.
  [/\bSafari\//, "Safari"],
];

const OPERATING_SYSTEMS: [RegExp, string][] = [
  // iPadOS 13+ reports itself as a Mac, and is separated by touch support in
  // `deviceKind` rather than here — there is nothing in the string to go on.
  [/\biPhone\b|\biPod\b/, "iOS"],
  [/\biPad\b/, "iPadOS"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bWindows NT\b|\bWin64\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bLinux\b|\bX11\b/, "Linux"],
];

function firstMatch(
  userAgent: string,
  table: [RegExp, string][],
  fallback: string,
): string {
  for (const [pattern, label] of table) {
    if (pattern.test(userAgent)) return label;
  }
  return fallback;
}

/**
 * Desktop, mobile or tablet.
 *
 * `maxTouchPoints` is passed in because iPadOS 13 and later send a desktop Mac
 * user-agent verbatim — the string alone cannot distinguish an iPad from a
 * MacBook, and a touch-capable "Mac" is the only signal there is.
 */
function deviceKind(userAgent: string, maxTouchPoints = 0): DeviceKind {
  if (/\biPad\b/.test(userAgent)) return "tablet";
  if (/\bAndroid\b/.test(userAgent) && !/\bMobile\b/.test(userAgent)) {
    // Android tablets omit the "Mobile" token; phones include it.
    return "tablet";
  }
  if (/\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1) return "tablet";
  if (
    /\bMobi\b|\biPhone\b|\biPod\b|\bAndroid\b|\bWindows Phone\b/.test(userAgent)
  ) {
    return "mobile";
  }
  return "desktop";
}

export function summarizeAgent(
  userAgent: string,
  maxTouchPoints = 0,
): AgentSummary {
  const device = deviceKind(userAgent, maxTouchPoints);
  let os = firstMatch(userAgent, OPERATING_SYSTEMS, "Other");

  // A touch-capable "Mac" is an iPad; correcting it here keeps the OS and the
  // device from contradicting each other in the breakdown.
  if (os === "macOS" && device === "tablet") os = "iPadOS";

  return {
    browser: firstMatch(userAgent, BROWSERS, "Other"),
    os,
    device,
  };
}
