import {
  Activity,
  Camera,
  MessageCircle,
  Trophy,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { LIFE_UPDATE_CATEGORY } from "@/lib/constants";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  [LIFE_UPDATE_CATEGORY.WATCHING]: Tv,
  [LIFE_UPDATE_CATEGORY.ACTIVITY]: Activity,
  [LIFE_UPDATE_CATEGORY.PHOTO]: Camera,
  [LIFE_UPDATE_CATEGORY.THOUGHT]: MessageCircle,
  [LIFE_UPDATE_CATEGORY.MILESTONE]: Trophy,
};

/**
 * A life-update category's icon. These were emoji, which every
 * platform draws differently and in full colour, so the one coloured mark in
 * a line of text was a picture the theme could not touch. Line icons take
 * the text colour like every other icon on the site. Decorative: the label
 * beside it names the category. An unknown value falls back to Thought, as
 * `categoryOption` does.
 */
export function CategoryIcon({
  category,
  className,
}: {
  category?: string | null;
  className?: string;
}) {
  const Icon = (category && ICONS[category]) || MessageCircle;
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} />;
}
