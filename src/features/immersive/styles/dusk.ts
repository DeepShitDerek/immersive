import type { StyleDefinition } from "./types";

export const dusk: StyleDefinition = {
  id: "dusk",
  label: "Dusk",
  description: "Deep night blue, a soft drifting colour field, frosted panels.",
  scheme: "dark",
  colors: {
    page: "#07071a",
    surface: "#12122b",
    text: "#eef0ff",
    muted: "#a9aecb",
    hairline: "#2a2b4d",
    control: "#7f84a8",
    accent: "#c9ccff",
    onAccent: "#07071a",
  },
  fonts: {
    display: "var(--font-inter-tight), var(--stack-sans)",
    text: "var(--font-inter-tight), var(--stack-sans)",
  },
  display: {
    weight: 500,
    tracking: "-0.04em",
    leading: "0.92",
    uppercase: false,
  },
  texture: "field",
  motion: { duration: 1.2, ease: "sine.out", stagger: 0.12 },
};
