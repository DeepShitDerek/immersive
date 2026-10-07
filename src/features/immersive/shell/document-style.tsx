"use client";

import { useEffect } from "react";
import { isImmersive, type ImmersiveStyle } from "@/lib/site-style";
import { styleCss } from "../styles/css";
import { immersiveFontVars } from "../styles/fonts";
import { useSiteStyle } from "../styles/use-site-style";

/** Built once: constants only, see styleCss. */
const CSS = styleCss();

/**
 * Puts the whole document in an immersive style: the public site and the
 * workspace alike.
 *
 * It adds nothing visible. The stylesheet's `html:has([data-style-root])`
 * rule (styles/css.ts) sets the style's colours and faces on `<html>` once
 * this marker is on the page, so every screen, and everything drawn under
 * `<body>` (toasts, menus, dialogs), takes them. The public pages' texture
 * and scroll layouts are separate and stay public (ImmersiveScope): a film
 * grain over a ledger would be decoration at the cost of reading.
 */
export function DocumentStyle({ style }: { style: ImmersiveStyle }) {
  // The font variables are class names from next/font; a stylesheet can reach
  // <html> with a selector but cannot hand it a class. Lent while mounted.
  useEffect(() => {
    const html = document.documentElement;
    const added = immersiveFontVars
      .split(/\s+/)
      .filter((name) => name && !html.classList.contains(name));
    html.classList.add(...added);
    return () => html.classList.remove(...added);
  }, []);

  return (
    <>
      <style data-site-style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span hidden data-style-root={style} />
    </>
  );
}

/**
 * The owner's site style, applied to the document. Nothing for Classic,
 * where the owner's theme and typography are in charge.
 */
export function SiteStyleDocument() {
  const style = useSiteStyle();
  return isImmersive(style) ? <DocumentStyle style={style} /> : null;
}
