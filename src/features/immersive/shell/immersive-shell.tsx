"use client";

import type { ReactNode } from "react";
import type { SiteContent } from "@/types";
import type { ImmersiveStyle } from "@/lib/site-style";
import { ImmersiveHeader } from "./immersive-header";
import { ImmersiveFooter } from "./immersive-footer";
import { ImmersiveScope } from "./immersive-scope";

/**
 * A public page in an immersive style: the token scope, the texture, the
 * header, `main#main-content`, the footer. The dev harness renders this
 * directly; the public chrome renders it when the owner's style is immersive.
 */
export function ImmersiveShell({
  style,
  identity,
  children,
}: {
  style: ImmersiveStyle;
  identity?: SiteContent;
  children: ReactNode;
}) {
  return (
    <ImmersiveScope style={style}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-skip focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <ImmersiveHeader identity={identity} />
      <main id="main-content" className="w-full grow">
        {children}
      </main>
      <ImmersiveFooter identity={identity} />
    </ImmersiveScope>
  );
}
