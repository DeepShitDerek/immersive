/**
 * When the overview earns its corner.
 *
 * It was drawn on an empty map and took a quarter of a phone screen. Now it
 * appears once the map is big enough to get lost in, and never on a phone,
 * where the screen is the map. The owner's setting still turns it off.
 */
export const MINIMAP_MIN_NODES = 8;

export function minimapVisible({
  enabled,
  nodeCount,
  isMobile,
}: {
  enabled: boolean;
  nodeCount: number;
  isMobile: boolean;
}): boolean {
  return enabled && !isMobile && nodeCount > MINIMAP_MIN_NODES;
}
