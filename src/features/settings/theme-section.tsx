"use client";

import { useMemo } from "react";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { THEME_PRESETS } from "@/lib/constants";
import { CUSTOM_THEME } from "@/lib/themes";
import { AA_NORMAL_TEXT, contrastRatioHex } from "@/lib/color-utils";
import { cn } from "@/lib/cn";
import { FieldGroup, type SettingsForm } from "./settings-controls";

const CUSTOM_COLOR_KEYS = [
  { key: "background", label: "Background" },
  { key: "foreground", label: "Text" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "card", label: "Card" },
] as const;

/**
 * The pairs a custom palette can realistically get wrong.
 *
 * The 52 presets are gated at AA by `theme-contrast.test.ts` at build time.
 * Custom colours are typed at runtime and reach no test at all, so the same
 * check has to run here — using the same `contrastRatio` the build gate uses,
 * not a second implementation that might round the other way.
 */
const CHECKED_PAIRS = [
  { on: "background", of: "foreground", label: "Text on background" },
  { on: "card", of: "foreground", label: "Text on cards" },
  { on: "primary", of: "background", label: "Background on primary" },
  { on: "accent", of: "background", label: "Background on accent" },
] as const;

function ThemeSwatch({ preset }: { preset: string }) {
  // The swatch is the preset class applied to a small subtree, so the colours
  // shown are literally the ones themes.css defines. A hand-kept table of
  // representative hex values would be 52 more things to keep in sync.
  return (
    <span
      className={cn(
        preset,
        "flex size-full gap-px overflow-hidden bg-background",
      )}
      aria-hidden
    >
      <span className="h-full flex-1 bg-background" />
      <span className="h-full flex-1 bg-card" />
      <span className="h-full flex-[2] bg-primary" />
      <span className="h-full flex-1 bg-accent" />
    </span>
  );
}

function ContrastReport({ colors }: { colors: Record<string, string> }) {
  const results = useMemo(
    () =>
      CHECKED_PAIRS.map((pair) => ({
        ...pair,
        ratio: contrastRatioHex(colors[pair.on] ?? "", colors[pair.of] ?? ""),
      })),
    [colors],
  );

  const failures = results.filter(
    (result) => result.ratio !== null && result.ratio < AA_NORMAL_TEXT,
  );
  const unreadable = results.some((result) => result.ratio === null);

  return (
    <div className="rounded-surface border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        {failures.length === 0 && !unreadable ? (
          <>
            <ShieldCheck className="size-4 text-success" aria-hidden />
            <p className="text-sm font-medium">
              Passes WCAG AA at {AA_NORMAL_TEXT}:1
            </p>
          </>
        ) : (
          <>
            <AlertTriangle className="size-4 text-warning" aria-hidden />
            <p className="text-sm font-medium">
              {unreadable
                ? "Enter six valid hex colours to check contrast"
                : `${failures.length} pair${failures.length === 1 ? "" : "s"} below AA`}
            </p>
          </>
        )}
      </div>

      <dl className="space-y-1.5">
        {results.map((result) => {
          const passes =
            result.ratio !== null && result.ratio >= AA_NORMAL_TEXT;
          return (
            <div
              key={result.label}
              className="flex items-baseline justify-between gap-4 text-xs"
            >
              <dt className="text-muted-foreground">{result.label}</dt>
              <dd
                className={cn(
                  "font-mono tabular-nums",
                  result.ratio === null
                    ? "text-muted-foreground"
                    : passes
                      ? "text-success"
                      : "text-warning",
                )}
              >
                {result.ratio === null ? "—" : `${result.ratio.toFixed(2)}:1`}
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        Below AA is allowed — this is your site. It is reported rather than
        blocked so the choice is a choice.
      </p>
    </div>
  );
}

export function ThemeSection({ form }: { form: SettingsForm }) {
  const selected = form.watch("profile_data.default_theme");
  const colors = form.watch("profile_data.custom_theme_colors") ?? {};

  return (
    <Tabs
      defaultValue={selected === CUSTOM_THEME ? "custom" : "presets"}
      className="w-full"
    >
      <TabsList className="mb-5 grid w-full grid-cols-2">
        <TabsTrigger value="presets">Presets</TabsTrigger>
        <TabsTrigger value="custom">Custom</TabsTrigger>
      </TabsList>

      <TabsContent value="presets">
        <FormField
          control={form.control}
          name="profile_data.default_theme"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div
                  role="radiogroup"
                  aria-label="Theme preset"
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  {THEME_PRESETS.map((preset) => {
                    const active = field.value === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => field.onChange(preset.value)}
                        className={cn(
                          "group overflow-hidden rounded-surface border bg-card text-left transition-colors focus-ring",
                          active
                            ? "border-primary ring-1 ring-primary"
                            : "hover:border-input",
                        )}
                      >
                        <span className="relative flex h-10 w-full">
                          <ThemeSwatch preset={preset.value} />
                          {active && (
                            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary">
                              <Check className="size-2.5 text-primary-foreground" />
                            </span>
                          )}
                        </span>
                        <span className="block truncate px-2.5 py-2 text-xs font-medium">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TabsContent>

      <TabsContent value="custom" className="space-y-5">
        <FieldGroup
          title="Six colours"
          description="Everything else — borders, muted text, popovers — is derived from these."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {CUSTOM_COLOR_KEYS.map(({ key, label }) => (
              <FormField
                key={key}
                control={form.control}
                name={`profile_data.custom_theme_colors.${key}` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{label}</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <input
                          type="color"
                          value={field.value || "#000000"}
                          onChange={field.onChange}
                          aria-label={`${label} colour`}
                          className="size-9 shrink-0 cursor-pointer rounded-control bg-transparent p-0"
                        />
                      </FormControl>
                      <Input
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        aria-label={`${label} hex`}
                        className="h-9 font-mono text-xs"
                        placeholder="#000000"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </FieldGroup>

        <ContrastReport colors={colors as Record<string, string>} />

        <FormField
          control={form.control}
          name="profile_data.default_theme"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-6 rounded-surface border bg-card p-3.5">
              <div className="space-y-0.5">
                <FormLabel className="cursor-pointer">
                  Use these colours
                </FormLabel>
                <FormDescription>
                  {field.value === CUSTOM_THEME
                    ? "The custom palette is live on the public site."
                    : "Presets are live. Switch to apply the colours above."}
                </FormDescription>
              </div>
              <button
                type="button"
                onClick={() =>
                  field.onChange(
                    field.value === CUSTOM_THEME
                      ? THEME_PRESETS[0].value
                      : CUSTOM_THEME,
                  )
                }
                className={cn(
                  "shrink-0 rounded-control px-3 py-1.5 text-xs font-semibold transition-colors",
                  field.value === CUSTOM_THEME
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {field.value === CUSTOM_THEME ? "In use" : "Switch"}
              </button>
            </FormItem>
          )}
        />
      </TabsContent>
    </Tabs>
  );
}
