"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hasStoredSession, rest } from "@/lib/rest";
import { summarizeAgent } from "./visitor-agent";
import { classifySource, countryFromTimezone } from "./visitor-source";

/**
 * Record a page view.
 *
 * Replaces `use-visit-notifier`, which posted a Discord message per session and
 * stored nothing — so there was never an answer to "how many people came this
 * month", only a channel full of pings.
 *
 * Everything here is best-effort and silent. Analytics must never be able to
 * break, slow, or block a page: a failed insert, a blocked geo lookup and a
 * database without the analytics tables all end the same way, with the
 * visitor none the wiser.
 */

const GEO_ENDPOINT = "https://ipapi.co/json/";
const GEO_CACHE_KEY = "visitGeo";
const GEO_TIMEOUT_MS = 2_000;

interface GeoResult {
  country: string | null;
  region: string | null;
  city: string | null;
  network: string | null;
}

const EMPTY_GEO: GeoResult = {
  country: null,
  region: null,
  city: null,
  network: null,
};

/**
 * Look the visitor up, once per session.
 *
 * The call is made by the visitor's own browser rather than from the server,
 * which is not only simpler here — a static export has no server — but is what
 * makes it free at any scale: ipapi.co's free quota is counted per calling
 * address, so each visitor spends their own allowance and there is no shared
 * limit to exhaust.
 *
 * It will be blocked for anyone running an ad-blocker, which is a normal path
 * rather than an error. `countryFromTimezone` covers the country in that case.
 */
async function lookupGeo(): Promise<GeoResult> {
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) return JSON.parse(cached) as GeoResult;
  } catch {
    // Storage can be unavailable (private mode); just look it up again.
  }

  try {
    // Without a timeout a hanging request would keep the promise, and the
    // insert behind it, pending for the life of the page.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const response = await fetch(GEO_ENDPOINT, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) return EMPTY_GEO;
    const body = (await response.json()) as Record<string, unknown>;

    const geo: GeoResult = {
      country: typeof body.country_code === "string" ? body.country_code : null,
      region: typeof body.region === "string" ? body.region : null,
      city: typeof body.city === "string" ? body.city : null,
      network: typeof body.org === "string" ? body.org : null,
    };

    try {
      sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo));
    } catch {
      // Best-effort.
    }
    return geo;
  } catch {
    return EMPTY_GEO;
  }
}

/** Trim to the column's ceiling so a long value is stored, not rejected. */
function clamp(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}

export function useVisitTracker(): void {
  const pathname = usePathname();

  useEffect(() => {
    // No database, no analytics. Static mode keeps working; it just has
    // nowhere to record anything.
    if (!rest) return;

    // Off in development, because a page you reload forty times while building
    // it is not forty visits. `NEXT_PUBLIC_ANALYTICS_DEBUG` turns it back on
    // deliberately, which is the only way to check the pipeline end to end
    // before shipping it.
    const debug = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1";
    if (process.env.NODE_ENV !== "production" && !debug) return;

    // The admin is not an audience. Recording your own navigation would put
    // your desk at the top of every chart.
    if (pathname?.startsWith("/admin")) return;

    let cancelled = false;

    const record = async () => {
      /**
       * Signed in means it is you.
       *
       * Skipping `/admin` was never enough: the owner reads their own public
       * site constantly — checking a post rendered, sending someone a link —
       * and every one of those was landing in the figures. There is exactly
       * one account, so a session is proof of who this is.
       */
      // Read from storage, not through supabase-js, which would cost every
      // visitor ~59 KB for this one yes/no.
      if (hasStoredSession() && !debug) return;
      // Automated browsers (checks, crawlers driven by WebDriver) are not
      // visitors; the build's own checks were landing in the figures.
      if (navigator.webdriver && !debug) return;
      if (cancelled) return;

      const geo = await lookupGeo();
      if (cancelled) return;

      const agent = summarizeAgent(
        navigator.userAgent,
        navigator.maxTouchPoints ?? 0,
      );

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;

      const {
        referrerHost,
        source,
        channel,
        utmSource,
        utmMedium,
        utmCampaign,
      } = classifySource({
        referrer: document.referrer,
        url: window.location.href,
        origin: window.location.origin,
      });

      await rest!.from("site_visits").insert({
        path: (pathname || "/").slice(0, 512),
        referrer_host: clamp(referrerHost, 255),
        source: clamp(source, 128),
        channel,
        utm_source: clamp(utmSource, 128),
        utm_medium: clamp(utmMedium, 128),
        utm_campaign: clamp(utmCampaign, 128),
        // Timezone is the fallback, not the preference: the lookup knows the
        // country of the connection, the timezone knows the country of the
        // clock — and a traveller's laptop disagrees with both.
        country: clamp(geo.country, 2) ?? countryFromTimezone(timezone ?? ""),
        region: clamp(geo.region, 128),
        city: clamp(geo.city, 128),
        network: clamp(geo.network, 200),
        timezone: clamp(timezone, 64),
        language: clamp(navigator.language, 32),
        browser: agent.browser,
        os: agent.os,
        device: agent.device,
        screen_width: window.screen?.width ?? null,
      });
    };

    void record().catch(() => {
      // Telemetry never surfaces to the visitor.
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);
}
