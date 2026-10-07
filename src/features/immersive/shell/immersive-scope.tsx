"use client";

import type { ReactNode } from "react";
import type { ImmersiveStyle } from "@/lib/site-style";
import { cn } from "@/lib/cn";
import { immersiveFontVars } from "../styles/fonts";
import { DocumentStyle } from "./document-style";
import { ImmersiveStyles } from "./immersive-styles";

/**
 * A public screen in an immersive style: the token scope and the texture.
 *
 * The document as a whole is put in the style by `DocumentStyle`, which the
 * app's providers render on every page when the owner's style is immersive.
 * It is rendered here too, so a screen shown under a style that is not the
 * saved one (the dev harness) is still styled all the way out; two markers
 * for the same style on one page are harmless.
 */
export function ImmersiveScope({
  style,
  className,
  children,
}: {
  style: ImmersiveStyle;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-style-scope={style}
      className={cn(
        "flex min-h-[100dvh] flex-col bg-background text-foreground",
        immersiveFontVars,
        className,
      )}
    >
      <DocumentStyle style={style} />
      <ImmersiveStyles tokens={false} />
      {children}
    </div>
  );
}
