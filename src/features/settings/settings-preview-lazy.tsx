"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { SettingsPreviewProps } from "./settings-preview";

/**
 * The preview, behind a split boundary.
 *
 * It imports the real public views, which pull in `Band`, `Markdown`
 * (remark-gfm), `StatusPanel` and the public page chunk generally. Imported
 * directly it took `/admin/settings` to 409 kB first load — the largest route
 * in the app, on a screen most visits open only to change one string. It is
 * also hidden below `xl` and inside a sheet elsewhere, so almost no first
 * paint needs it.
 */
export const SettingsPreviewLazy = dynamic<SettingsPreviewProps>(
  () => import("./settings-preview").then((mod) => mod.SettingsPreview),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="h-full min-h-64 w-full rounded-surface" />
    ),
  },
);
