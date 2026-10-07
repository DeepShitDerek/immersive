import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { config as appConfig } from "@/lib/config";
import { fetchSiteIdentity, orUndefined } from "@/lib/public-data";
import { ogLook } from "./look";

/**
 * The link-preview card: what LinkedIn, X, Slack and iMessage show
 * when someone shares a page. Rendered once per page at build — static export
 * has no server to draw one on request — so every file under /og/ is a real
 * PNG on the CDN.
 *
 * satori + resvg directly rather than `next/og`: Next 14's bundled copy
 * builds its own asset paths with `path.join` on a file URL, which throws
 * "Invalid URL" on Windows and fails the build there.
 *
 * A Classic site's card is drawn in the default preset (Space Grotesk over
 * Inter on the warm ground, blue accent) rather than the owner's chosen
 * theme: the card has to read at thumbnail size in someone else's feed, and
 * the default pairing is the one checked for that. A site in an immersive
 * style gets that style's card instead (look.ts). Cards are drawn at build,
 * so a style change reaches them with the next deploy.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

// Static (non-variable) cuts — satori reads WOFF but not WOFF2 or variable
// fonts. Space Grotesk and Inter for the Classic card, Inter Tight and
// Instrument Serif for the immersive styles; all SIL OFL 1.1, from @fontsource.
const FONT_DIR = path.join(process.cwd(), "src/app/fonts/og");

const FONT_FILES = [
  ["Heading", 700, "space-grotesk-latin-700-normal.woff"],
  ["Body", 400, "inter-latin-400-normal.woff"],
  ["Body", 600, "inter-latin-600-normal.woff"],
  ["Inter Tight", 400, "inter-tight-latin-400-normal.woff"],
  ["Inter Tight", 600, "inter-tight-latin-600-normal.woff"],
  ["Inter Tight", 700, "inter-tight-latin-700-normal.woff"],
  ["Instrument Serif", 400, "instrument-serif-latin-400-normal.woff"],
] as const;

async function fonts() {
  return Promise.all(
    FONT_FILES.map(async ([name, weight, file]) => ({
      name,
      weight,
      style: "normal" as const,
      data: await readFile(path.join(FONT_DIR, file)),
    })),
  );
}

/**
 * The owner's name and site style as the CMS has them at build. Without a
 * database: the config's name, and the Classic card.
 */
async function siteAtBuild(): Promise<{ name: string; style: unknown }> {
  const identity = await orUndefined(fetchSiteIdentity());
  return {
    name: identity?.profile_data?.name?.trim() || appConfig.site.author,
    style: identity?.profile_data?.site_style,
  };
}

/** "johndoe.dev" — or nothing while the site URL is still the placeholder. */
function siteHost(): string | null {
  try {
    const host = new URL(appConfig.site.url).hostname.replace(/^www\./, "");
    return host === "example.com" ? null : host;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export interface OgCard {
  /** Small line above the title: "Case study", "Writing", … */
  eyebrow?: string;
  title: string;
  /** One or two sentences under the title. */
  description?: string | null;
}

export async function renderOgCard({
  eyebrow,
  title,
  description,
}: OgCard): Promise<Response> {
  const [site, fontList] = await Promise.all([siteAtBuild(), fonts()]);
  const { name } = site;
  const look = ogLook(site.style);
  const host = siteHost();
  const heading = clip(title, 110);
  // Long titles step down so three lines still fit above the footer.
  // Capitals run wider, so an uppercase title steps down one size sooner.
  const length = heading.length * (look.uppercase ? 1.25 : 1);
  const size = length > 70 ? 56 : length > 40 ? 68 : 80;

  const svg = await satori(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: look.ground,
        // Kept to the right edge and the bottom corner, and faint, so the
        // title and description stay on the plain ground.
        ...(look.glow
          ? {
              backgroundImage:
                "radial-gradient(circle at 100% 0%, rgba(91, 75, 255, 0.45), transparent 42%), radial-gradient(circle at 96% 100%, rgba(24, 200, 192, 0.28), transparent 38%)",
            }
          : {}),
        color: look.ink,
        fontFamily: look.bodyFont,
        borderLeft: `16px solid ${look.accent}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow && (
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: look.accent,
              marginBottom: 24,
            }}
          >
            {clip(eyebrow, 48)}
          </div>
        )}
        <div
          style={{
            fontFamily: look.headingFont,
            fontWeight: look.headingWeight,
            fontSize: size,
            lineHeight: look.uppercase ? 1 : 1.08,
            letterSpacing: look.tracking,
            textTransform: look.uppercase ? "uppercase" : "none",
          }}
        >
          {heading}
        </div>
        {description && (
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.4,
              color: look.muted,
              // Satori honours line clamping only through this pair.
              display: "block",
              lineClamp: 2,
            }}
          >
            {clip(description, 170)}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: look.accent,
              color: look.onAccent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 24,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontWeight: 600 }}>{name}</div>
        </div>
        {host && <div style={{ color: look.muted }}>{host}</div>}
      </div>
    </div>,
    { ...OG_SIZE, fonts: fontList },
  );
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_SIZE.width },
  })
    .render()
    .asPng();

  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
}
