import { Info } from "lucide-react";
import {
  STYLE_DEFINITIONS,
  isImmersive,
  type SiteStyle,
} from "@/features/immersive/styles";

/**
 * Shown above Theme and Typography while an immersive site style is chosen.
 *
 * In Noir, Paper or Dusk the public site and this workspace both take their
 * colours and type from the style, so these two settings change nothing.
 * They stay editable (what is chosen here comes back with Classic), and
 * saying so is better than a picker that appears to do nothing.
 */
export function StyleGovernsNotice({
  style,
  setting,
}: {
  style: SiteStyle;
  /** "Theme" or "Typography". */
  setting: string;
}) {
  if (!isImmersive(style)) return null;
  const { label } = STYLE_DEFINITIONS[style];
  return (
    <p
      role="note"
      className="mb-5 flex gap-3 rounded-surface border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
      <span>
        <span className="font-medium text-foreground">
          The {label} site style is in charge.
        </span>{" "}
        {label} brings its own colours and type to the public site and to this
        workspace, so {setting} has no effect while it is selected. What you
        choose here is kept, and applies again when Site style is Classic.
      </span>
    </p>
  );
}
