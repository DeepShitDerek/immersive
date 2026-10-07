import type { StyleDefinition } from "./types";

export const paper: StyleDefinition = {
  id: "paper",
  label: "Paper",
  description:
    "Warm off-white, an oversized serif, ink black, one indigo accent.",
  scheme: "light",
  colors: {
    page: "#f4f0e6",
    surface: "#ebe6d9",
    text: "#16140f",
    muted: "#5c574c",
    hairline: "#d3ccba",
    control: "#7d7768",
    accent: "#2f3bd6",
    onAccent: "#ffffff",
  },
  fonts: {
    display: "var(--font-instrument-serif), Georgia, serif",
    text: "var(--font-inter-tight), var(--stack-sans)",
  },
  display: {
    weight: 400,
    tracking: "-0.02em",
    leading: "0.92",
    uppercase: false,
  },
  texture: "rules",
  motion: { duration: 0.8, ease: "power2.inOut", stagger: 0.08 },
};
