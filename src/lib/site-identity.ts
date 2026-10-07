import type { SiteContent } from "@/types";
import { SITE_IDENTITY_DEFAULTS } from "./site-identity-defaults";
import { resolveSiteStyle } from "./site-style";

/**
 * Fill in a `site_identity` row so the rest of the app can trust its shape.
 *
 * `profile_data`, `social_links` and `footer_data` are nullable JSONB columns.
 * Nothing in Postgres constrains what is inside them, but `SiteContent` types
 * every nested key as required — so the hero read
 * `profile_data.status_panel.availability` three levels deep with no guard. A
 * row written before a key existed, hand-edited in the SQL editor, or produced
 * by a partial settings save takes down the **public homepage** for every
 * visitor, not just the owner.
 *
 * Normalising once at the data boundary is preferable to optional chaining
 * scattered through the renderers: the components keep their honest types, and
 * there is a single place that decides what "missing" means.
 *
 * This is used by `publicApi.getSiteIdentity` **and** by the settings form. It
 * used not to be: the settings page carried its own sixty-line `nullsToStrings`
 * + merge + pad block inside a `useEffect`, so the same question had two
 * answers, only one of which had a test behind it. The form now loads through
 * here, and the differences that block relied on (padding arrays to a fixed
 * number of inputs) are gone with the fixed-slot inputs that needed them.
 *
 * Deliberately Zod-free. `publicApi` is on every route, so pulling the schema
 * module in here would put Zod in every public page's first load.
 */

/**
 * Recursively fill `value` from `defaults`.
 *
 * Handles the three ways a JSONB blob disappoints you at once: a key that is
 * absent, a key that is explicitly `null`, and a key holding the wrong type
 * (a string where an object belongs, because someone edited the row by hand).
 * In every case the default's leaf wins, so the result matches the shape of
 * `defaults` exactly.
 *
 * Arrays are taken wholesale rather than merged element-wise — a stored list of
 * two bio paragraphs must not inherit a third from the defaults.
 */
function mergeDefaults<T>(defaults: T, value: unknown): T {
  if (value === null || value === undefined) return defaults;

  if (Array.isArray(defaults)) {
    return (Array.isArray(value) ? value : defaults) as T;
  }

  if (
    typeof defaults === "object" &&
    defaults !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const source = value as Record<string, unknown>;
    // Start from the stored object so keys the defaults do not know about
    // survive a round-trip, then overlay every key the shape requires.
    const out: Record<string, unknown> = { ...source };
    for (const key of Object.keys(defaults as Record<string, unknown>)) {
      out[key] = mergeDefaults(
        (defaults as Record<string, unknown>)[key],
        source[key],
      );
    }
    return out as T;
  }

  // Primitive: keep the stored value only if it is the same kind of thing.
  return (typeof value === typeof defaults ? value : defaults) as T;
}

/** Drop blank entries from a string list; used for both editable arrays. */
function withoutBlanks(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

/**
 * Social links are the one part of the blob with no fixed shape to merge
 * against — the list is open, so each entry is repaired individually.
 *
 * The previous settings form matched stored links against a hard-coded default
 * list by `id` and kept only what matched, so a link the defaults file had
 * never heard of was silently dropped the next time settings were saved.
 */
function normalizeSocialLinks(value: unknown): SiteContent["social_links"] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const link = (entry ?? {}) as Record<string, unknown>;
    const id =
      typeof link.id === "string" && link.id.trim() !== ""
        ? link.id
        : `link-${index + 1}`;
    return {
      id,
      label: typeof link.label === "string" ? link.label : id,
      url: typeof link.url === "string" ? link.url : "",
      // Absent means visible: a link written before the column existed should
      // show, not vanish.
      is_visible: link.is_visible !== false,
    };
  });
}

/**
 * The hero's results. Each entry is repaired to two strings, and one with no
 * figure is dropped — a label under an empty number is not a result.
 */
function normalizeProof(list: unknown): SiteContent["profile_data"]["proof"] {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return {
        value: typeof item.value === "string" ? item.value.trim() : "",
        label: typeof item.label === "string" ? item.label.trim() : "",
      };
    })
    .filter((item) => item.value !== "");
}

export function normalizeSiteContent(row: Partial<SiteContent>): SiteContent {
  const merged = mergeDefaults(
    SITE_IDENTITY_DEFAULTS as unknown as SiteContent,
    row,
  );
  const panel = merged.profile_data.status_panel;

  return {
    ...merged,
    profile_data: {
      ...merged.profile_data,
      // `bio` is mapped over on /about; blanks would render empty paragraphs.
      // The seeded default is `[""]`, so this also turns a never-configured
      // site into an empty list rather than one blank paragraph.
      bio: withoutBlanks(merged.profile_data.bio),
      proof: normalizeProof(merged.profile_data.proof),
      site_style: resolveSiteStyle(merged.profile_data.site_style),
      status_panel: {
        ...panel,
        currently_exploring: {
          ...panel.currently_exploring,
          items: withoutBlanks(panel.currently_exploring.items),
        },
      },
    },
    social_links: normalizeSocialLinks(row.social_links),
  };
}
