import type { StyleDefinition } from "./types";

export const noir: StyleDefinition = {
  id: "noir",
  label: "Noir",
  description:
    "Near-black, huge uppercase type, one electric accent, film grain.",
  scheme: "dark",
  colors: {
    page: "#0b0b0c",
    surface: "#151516",
    text: "#f2efe8",
    muted: "#a3a39b",
    hairline: "#2a2a27",
    control: "#8a8a82",
    accent: "#d8ff3e",
    onAccent: "#0b0b0c",
  },
  fonts: {
    display: "var(--font-inter-tight), var(--stack-sans)",
    text: "var(--font-inter-tight), var(--stack-sans)",
  },
  display: {
    weight: 700,
    tracking: "-0.045em",
    leading: "0.86",
    uppercase: true,
  },
  texture: "grain",
  motion: { duration: 0.35, ease: "power4.out", stagger: 0.04 },
};
