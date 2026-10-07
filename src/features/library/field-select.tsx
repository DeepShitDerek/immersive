import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * A native select in the Input's clothes.
 *
 * Native rather than Radix for the Library's small fixed lists: it takes an
 * empty value ("no source", "no rating") without a sentinel, and on a phone it
 * opens the platform picker.
 */
export const FieldSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function FieldSelect({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full min-w-0 rounded-control border border-input bg-background px-3 text-sm",
        "focus-ring disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
