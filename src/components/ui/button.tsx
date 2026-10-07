import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Controls.
 *
 * One shape everywhere: the control radius, set per theme (6px in Field
 * Notes). Pills are for chips and status only.
 *
 * - **primary** (default) is filled and changes fill on hover. It does not
 *   lift: a button that moves under the pointer is decoration (concept A),
 *   and one filled primary per viewport is the rule.
 * - **outline** is the secondary: a 1px `--input` edge, which every preset
 *   holds at 3:1 against its ground (WCAG 1.4.11, gated by check:themes).
 * - **destructive** is for confirm flows that cannot be undone.
 *
 * Heights are 32 / 40 / 48px, and at least 44px under a coarse pointer
 * whatever the size, so nothing is a small target on a phone.
 *
 * `overflow-hidden` is dropped — it clipped focus rings on buttons that sit
 * flush against a container edge.
 */
const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-control text-sm font-semibold transition-[background-color,border-color,color] duration-fast ease-enter focus-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent text-foreground hover:border-foreground/60 hover:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 [@media(pointer:coarse)]:min-h-11",
        sm: "h-8 px-3 [@media(pointer:coarse)]:min-h-11",
        lg: "h-12 px-5 text-base",
        icon: "size-10 [@media(pointer:coarse)]:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
