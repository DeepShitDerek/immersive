import type { SiteContent } from "@/types";
import { safeImageUrl } from "@/lib/safe-url";
import { plainPreview } from "@/lib/text-preview";
import { hasStatus } from "../home/home-model";

/**
 * What the About page has to show. A part with nothing in it is left out,
 * not padded: a site with only a name is the name.
 */
export function aboutParts(identity: SiteContent): {
  name: string;
  /** The first of a "Role | Role" title, as the Classic page shows it. */
  role: string;
  /** The first bio paragraph as plain text: it is set large, word by word. */
  lead: string;
  rest: string[];
  /** Only when switched on, and only an address the image allowlist accepts. */
  picture: string | null;
  proof: boolean;
  now: boolean;
} {
  const profile = identity.profile_data;
  const [first, ...rest] = (profile.bio ?? []).filter((p) => p?.trim());
  return {
    name: profile.name,
    role: profile.title?.split("|")[0]?.trim() ?? "",
    lead: first ? plainPreview(first) : "",
    rest,
    picture: profile.show_profile_picture
      ? safeImageUrl(profile.profile_picture_url)
      : null,
    proof: (profile.proof ?? []).length > 0,
    now: hasStatus(profile.status_panel),
  };
}
