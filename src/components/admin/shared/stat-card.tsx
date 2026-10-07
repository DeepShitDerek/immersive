// Unified statistic display card for all admin modules
//
// Accepts icons as either a LucideIcon component reference (`icon={Eye}`)
// or a pre-rendered ReactNode (`icon={<Eye className="size-4" />}`).

import { ReactNode, isValidElement } from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  /** Card title displayed at the top */
  title: string;
  /** Main value to display (e.g., "$1,234" or "42") */
  value: string | number;
  /** Icon — either a LucideIcon component or a pre-rendered ReactNode */
  icon?: LucideIcon | ReactNode;
  /** Optional help text or sub-value displayed below the main value */
  helpText?: string;
  /** @deprecated Use `helpText` instead. Alias kept for backwards compatibility. */
  subValue?: string;
  /** Trend direction for styling */
  trend?: "up" | "down" | "neutral";
  /** Highlight the card with primary color gradient */
  highlight?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Card size variant */
  size?: "default" | "compact";
}

/**
 * Returns true when the icon prop is a component reference (function, class,
 * or forwardRef object) rather than an already-rendered ReactNode (JSX element).
 */
function isIconComponent(icon: StatCardProps["icon"]): icon is LucideIcon {
  // forwardRef returns an object (not a function), so typeof alone is insufficient.
  // Instead, check if it's NOT an already-rendered JSX element.
  return !isValidElement(icon);
}

export default function StatCard({
  title,
  value,
  icon,
  helpText,
  subValue,
  trend,
  highlight = false,
  className,
  size = "default",
}: StatCardProps) {
  const description = helpText ?? subValue;

  /**
   * Trend styling lived inline three times over, and had drifted —
   * `text-green-500` in one branch, `text-green-600` in the next. It also used
   * literal palette colours, which do not move with the 52 theme presets: a
   * green-500 chip stays the same green on a green-tinted theme. `chart-2` is
   * the success token the task module already established.
   */
  const trendClasses = (() => {
    if (trend === "up") return "text-chart-2 bg-chart-2/10";
    if (trend === "down") return "text-destructive bg-destructive/10";
    if (highlight) return "text-primary bg-primary/10";
    return "text-muted-foreground bg-muted";
  })();

  const trendTextClass =
    trend === "up"
      ? "text-chart-2"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  const renderIcon = () => {
    if (!icon) return null;

    // Pre-rendered ReactNode (e.g. `<Wallet className="size-4" />`)
    if (!isIconComponent(icon)) {
      return <div className={cn("p-2 rounded-full", trendClasses)}>{icon}</div>;
    }

    // LucideIcon component reference (e.g. `Eye`)
    const Icon = icon;
    return (
      <div className={cn("p-2 rounded-full", trendClasses)}>
        <Icon className="size-4" />
      </div>
    );
  };

  const renderDescription = () => {
    if (!description) return null;

    return (
      <p className={cn("text-xs mt-1 flex items-center gap-1", trendTextClass)}>
        {trend === "up" && <TrendingUp className="size-3" />}
        {trend === "down" && <TrendingDown className="size-3" />}
        {description}
      </p>
    );
  };

  return (
    <Card
      className={cn(
        "overflow-hidden transition-[box-shadow] duration-base ease-enter",
        // A highlighted gauge is raised rather than tinted with a gradient and
        // a coloured border — elevation is how v3 says "this one matters".
        highlight && "shadow-e2",
        className,
      )}
    >
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between space-y-0",
          size === "compact" ? "pb-1 pt-3 px-4" : "pb-2",
        )}
      >
        <CardTitle
          className={cn(
            "t-micro font-normal",
            highlight ? "text-primary" : "text-muted-foreground",
          )}
        >
          {title}
        </CardTitle>
        {renderIcon()}
      </CardHeader>
      <CardContent className={cn(size === "compact" && "pb-3 px-4")}>
        <div
          className={cn(
            "font-heading font-bold tabular-nums tracking-tight",
            size === "compact" ? "text-xl" : "text-2xl",
          )}
        >
          {value}
        </div>
        {renderDescription()}
      </CardContent>
    </Card>
  );
}
