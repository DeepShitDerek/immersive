"use client";

import { useMediaQuery } from "./use-media-query";

/**
 * True when the main pointer is a finger. For copy that names a gesture:
 * "double-click" and "press Tab" mean nothing on a phone.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
