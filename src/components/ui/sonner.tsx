"use client";

import { Toaster as Sonner } from "sonner";
import { useColorScheme } from "@/hooks/use-color-scheme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts: bottom-right on a desktop, bottom-centre on a
 * phone, lifted above the workspace tab bar there. Sonner pauses a toast
 * while it is hovered or focused, so an Undo (use-undoable-delete) cannot
 * run out under the pointer.
 *
 * The scheme comes from what is painted. It was next-themes' value, which
 * is a preset class such as "theme-field-notes-light" and not one of the
 * light / dark / system Sonner understands.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { scheme } = useColorScheme();

  return (
    <Sonner
      theme={scheme ?? "light"}
      position="bottom-right"
      mobileOffset={{
        bottom: "calc(var(--tabbar-h) + 1rem + env(safe-area-inset-bottom))",
      }}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-surface group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-e3",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-control group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground group-[.toast]:rounded-control group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm",
          closeButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-muted-foreground group-[.toast]:border-0 hover:group-[.toast]:bg-secondary group-[.toast]:p-1 group-[.toast]:rounded-control group-[.toast]:right-2 group-[.toast]:top-2",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
