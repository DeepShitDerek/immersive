"use client";

import { Check } from "lucide-react";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { TYPOGRAPHY_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { SettingsForm } from "./settings-controls";

export function TypographySection({ form }: { form: SettingsForm }) {
  return (
    <FormField
      control={form.control}
      name="profile_data.typography_preset"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TYPOGRAPHY_PRESETS.map((preset) => {
                const isActive = field.value === preset.value;
                // Mirrors the preset's own --font-heading / --heading-weight
                // so the preview can't drift from what themes.css applies.
                const headingFont = `"${preset.heading}", ${preset.serif ? "serif" : "sans-serif"}`;
                return (
                  <button
                    type="button"
                    key={preset.value}
                    aria-pressed={isActive}
                    onClick={() => field.onChange(preset.value)}
                    className={cn(
                      "group relative rounded-surface border-2 p-3.5 text-left transition-all",
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30 hover:bg-accent/20",
                    )}
                  >
                    {isActive && (
                      <div className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary">
                        <Check className="size-3 text-primary-foreground" />
                      </div>
                    )}

                    {/* Large display preview */}
                    <div className="mb-3 pr-6">
                      <p
                        className="text-2xl leading-tight text-foreground"
                        style={{
                          fontFamily: headingFont,
                          letterSpacing: "-0.02em",
                          fontWeight: preset.weight,
                        }}
                      >
                        Aa
                      </p>
                    </div>

                    {/* Mini site mockup */}
                    <div
                      className="mb-2.5 space-y-1.5 rounded border border-border/40 bg-background/60 p-2.5"
                      style={{ fontFamily: `"${preset.body}", sans-serif` }}
                    >
                      <p
                        className="text-sm leading-snug text-foreground"
                        style={{
                          fontFamily: headingFont,
                          fontWeight: preset.weight,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Hello, I&apos;m Derek
                      </p>
                      <p
                        className="text-xs leading-relaxed text-muted-foreground"
                        style={{
                          fontFamily: `"${preset.body}", sans-serif`,
                        }}
                      >
                        Building beautiful things for the web.
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded bg-muted/60 px-1.5 py-0.5 text-micro text-muted-foreground"
                          style={{
                            fontFamily: `"${preset.code}", monospace`,
                          }}
                        >
                          npm run dev
                        </span>
                        <span
                          className="text-micro text-primary"
                          style={{
                            fontFamily: `"${preset.body}", sans-serif`,
                          }}
                        >
                          View Projects →
                        </span>
                      </div>
                    </div>

                    {/* Label + font names */}
                    <p className="text-xs font-semibold text-foreground">
                      {preset.label}
                    </p>
                    <p className="mt-0.5 text-micro leading-relaxed text-muted-foreground">
                      {preset.description}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-micro text-muted-foreground">
                      <span>
                        Display{" "}
                        <span className="font-medium text-muted-foreground">
                          {preset.heading}
                        </span>
                      </span>
                      <span>
                        Body{" "}
                        <span className="font-medium text-muted-foreground">
                          {preset.body}
                        </span>
                      </span>
                      <span>
                        Code{" "}
                        <span className="font-medium text-muted-foreground">
                          {preset.code}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
