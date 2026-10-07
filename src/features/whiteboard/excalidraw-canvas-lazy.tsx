"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    /** Base URL Excalidraw resolves its font files against. */
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

/**
 * Excalidraw is by far the heaviest dependency in the app and it touches
 * `window` on import, so it is both code-split and client-only.
 *
 * The asset path is set inside the loader rather than in the component: fonts
 * are registered while the module evaluates, which happens before any render.
 * `scripts/copy-excalidraw-assets.mjs` puts the files where this points; if
 * one is missing the library falls back to its own CDN.
 */
const ExcalidrawCanvasLazy = dynamic(
  async () => {
    if (typeof window !== "undefined") {
      window.EXCALIDRAW_ASSET_PATH = "/excalidraw/";
    }
    const mod = await import("./excalidraw-canvas");
    return mod.ExcalidrawCanvas;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading whiteboard editor</span>
      </div>
    ),
  },
);

export default ExcalidrawCanvasLazy;
