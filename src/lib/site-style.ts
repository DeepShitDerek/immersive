/**
 * The public site's style: Classic (the themed site) or one of the immersive
 * styles. Stored as `profile_data.site_style` on the site_identity row.
 *
 * Anything that is not one of these four is Classic, so a row written before
 * the setting existed, or edited by hand, changes nothing.
 */
export const SITE_STYLES = ["classic", "noir", "paper", "dusk"] as const;

export type SiteStyle = (typeof SITE_STYLES)[number];
export type ImmersiveStyle = Exclude<SiteStyle, "classic">;

export function resolveSiteStyle(value: unknown): SiteStyle {
  return (SITE_STYLES as readonly unknown[]).includes(value)
    ? (value as SiteStyle)
    : "classic";
}

export function isImmersive(style: SiteStyle): style is ImmersiveStyle {
  return style !== "classic";
}
