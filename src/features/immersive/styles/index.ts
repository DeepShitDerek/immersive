import type { ImmersiveStyle } from "@/lib/site-style";
import type { StyleDefinition } from "./types";
import { noir } from "./noir";
import { paper } from "./paper";
import { dusk } from "./dusk";

export * from "@/lib/site-style";
export type { StyleDefinition } from "./types";

/**
 * How much of the page ground covers a project image behind text. Checked in
 * styles.test.ts against a white and a black image in every style.
 */
export const IMAGE_SCRIM = 0.9;

export const STYLE_DEFINITIONS: Record<ImmersiveStyle, StyleDefinition> = {
  noir,
  paper,
  dusk,
};
