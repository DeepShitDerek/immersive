import * as React from "react";

import { cn } from "@/lib/utils";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value"> {
  /**
   * Nullable because most columns behind these fields are nullable TEXT, and
   * react-hook-form hands the row value straight through. `null` is rendered
   * as an empty string.
   */
  value?: React.InputHTMLAttributes<HTMLInputElement>["value"] | null;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, ...props }, ref) => {
    return (
      <input
        type={type}
        // Only `null` is normalised — leaving `undefined` untouched keeps an
        // input the caller meant to be uncontrolled uncontrolled.
        value={value === null ? "" : value}
        className={cn(
          "flex h-10 w-full rounded-control border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
