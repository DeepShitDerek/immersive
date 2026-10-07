import { LucideIcon, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon;
  /** Main title text */
  title: string;
  /** Description text below title */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Additional CSS classes */
  className?: string;
  /** Additional content below action */
  children?: ReactNode;
  /** Visual variant */
  variant?: "default" | "bordered" | "card";
  /** Size variant */
  size?: "default" | "compact" | "large";
}

export default function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
  className,
  children,
  variant = "default",
  size = "default",
}: EmptyStateProps) {
  const sizeClasses = {
    compact: "py-8 px-4",
    default: "py-16 px-4",
    large: "py-24 px-6",
  };

  const iconSizes = {
    compact: "size-6",
    default: "size-8",
    large: "size-12",
  };

  const iconContainerSizes = {
    compact: "p-3",
    default: "p-4",
    large: "p-5",
  };

  const titleSizes = {
    compact: "text-base",
    default: "text-lg",
    large: "text-xl",
  };

  const variantClasses = {
    default: "",
    bordered:
      "border border-dashed border-border rounded-surface bg-secondary/40",
    card: "bg-card rounded-surface shadow-e1",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted/50 mb-4",
          iconContainerSizes[size],
        )}
      >
        <Icon className={cn("text-muted-foreground/70", iconSizes[size])} />
      </div>
      <h3
        className={cn(
          "font-heading font-semibold tracking-tight text-foreground",
          titleSizes[size],
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-6 p-4"
          size={size === "compact" ? "sm" : "default"}
        >
          {action.icon && <action.icon className="mr-2 size-4" />}
          {action.label}
        </Button>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
