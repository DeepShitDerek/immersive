import {
  AlertTriangle,
  CheckCircle2,
  GitFork,
  HelpCircle,
  Lightbulb,
  Sparkles,
  StickyNote,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NodeColor, NodeType } from "../domain/types";

/**
 * How node types and colours look. Every type has an icon *and* a name shown
 * on the node, so meaning never depends on colour alone (§48).
 */
export const TYPE_ICON: Record<NodeType, LucideIcon> = {
  idea: Lightbulb,
  problem: AlertTriangle,
  question: HelpCircle,
  decision: GitFork,
  action: Zap,
  goal: Target,
  solution: CheckCircle2,
  insight: Sparkles,
  note: StickyNote,
};

/**
 * HSL triplets, used as `hsl(var(--map-accent) / alpha)` over the theme's own
 * surfaces: a translucent fill and a stronger border read on light and dark
 * presets alike, and the text stays the theme's foreground colour, so
 * contrast is the theme's (all 56 presets pass AA).
 */
export const COLOR_HSL: Record<NodeColor, string> = {
  red: "0 72% 55%",
  orange: "25 90% 52%",
  yellow: "45 93% 47%",
  green: "142 60% 40%",
  blue: "217 85% 56%",
  purple: "262 70% 60%",
  pink: "330 75% 58%",
  gray: "220 9% 50%",
};

export const COLOR_LABEL: Record<NodeColor, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  gray: "Gray",
};
