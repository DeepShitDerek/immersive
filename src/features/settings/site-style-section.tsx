"use client";

import type { CSSProperties } from "react";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/cn";
import {
  SITE_STYLES,
  STYLE_DEFINITIONS,
  isImmersive,
  resolveSiteStyle,
  type SiteStyle,
} from "@/features/immersive/styles";
import { immersiveFontVars } from "@/features/immersive/styles/fonts";
import type { SettingsForm } from "./settings-controls";

const CLASSIC = {
  label: "Classic",
  description:
    "The themed site: your theme and typography, calm and nearly still.",
};

/** A small picture of the style: its ground, its display face, its accent. */
function Swatch({ style }: { style: SiteStyle }) {
  if (!isImmersive(style)) {
    return (
      <div className="flex h-24 flex-col justify-between rounded border border-border bg-background p-3">
        <span className="font-heading text-2xl font-semibold leading-none text-foreground">
          Aa
        </span>
        <span className="h-1 w-10 rounded-full bg-primary" />
      </div>
    );
  }
  const def = STYLE_DEFINITIONS[style];
  const ground: CSSProperties = {
    background: def.colors.page,
    color: def.colors.text,
    borderColor: def.colors.hairline,
  };
  const type: CSSProperties = {
    fontFamily: def.fonts.display,
    fontWeight: def.display.weight,
    letterSpacing: def.display.tracking,
    textTransform: def.display.uppercase ? "uppercase" : "none",
  };
  return (
    <div
      className="flex h-24 flex-col justify-between rounded border p-3"
      style={ground}
    >
      <span className="text-2xl leading-none" style={type}>
        Aa
      </span>
      <span
        className="h-1 w-10 rounded-full"
        style={{ background: def.colors.accent }}
      />
    </div>
  );
}

/**
 * Site style: Classic, or one of the three immersive looks. A native radio
 * group, so arrow keys and form semantics come with it.
 */
export function SiteStyleSection({ form }: { form: SettingsForm }) {
  return (
    <FormField
      control={form.control}
      name="profile_data.site_style"
      render={({ field }) => {
        const value = resolveSiteStyle(field.value);
        return (
          <FormItem>
            <FormControl>
              <fieldset className={immersiveFontVars}>
                <legend className="sr-only">Site style</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {SITE_STYLES.map((style) => {
                    const meta = isImmersive(style)
                      ? STYLE_DEFINITIONS[style]
                      : CLASSIC;
                    const checked = value === style;
                    return (
                      <label
                        key={style}
                        className={cn(
                          "relative block cursor-pointer rounded-surface border-2 p-3.5 transition-colors",
                          "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={style}
                          checked={checked}
                          onChange={() => field.onChange(style)}
                          onBlur={field.onBlur}
                          className="sr-only"
                        />
                        <Swatch style={style} />
                        <span className="mt-3 block text-sm font-semibold text-foreground">
                          {meta.label}
                        </span>
                        <span className="mt-0.5 block text-micro leading-relaxed text-muted-foreground">
                          {meta.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-4 text-micro leading-relaxed text-muted-foreground">
                  Noir, Paper and Dusk bring their own colours and type to the
                  public site and to this workspace, and give the public pages
                  scroll-led layouts. Theme and Typography apply while the style
                  is Classic. Visitors see a new style straight after the page
                  loads; use Publish site to make it the first thing they see.
                </p>
              </fieldset>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
