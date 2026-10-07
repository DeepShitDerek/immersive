import * as React from "react";

import { cn } from "@/lib/utils";

interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> {
  /** Nullable for the same reason as `Input` — see the note there. */
  value?: React.TextareaHTMLAttributes<HTMLTextAreaElement>["value"] | null;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, ...props }, ref) => {
    return (
      <textarea
        value={value === null ? "" : value}
        className={cn(
          "flex min-h-[80px] w-full rounded-control border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
