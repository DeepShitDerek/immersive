import { ReactNode, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Classes for the form's body, not the sheet. */
  className?: string;
  /** A wider sheet, for forms that lay out a picker or many fields. */
  wide?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  /**
   * Whether the form holds unsaved input. Left out, the sheet works it out:
   * anything typed or changed inside it since it opened counts. A sheet that
   * saves in place and stays open (projects, reconcile) must pass it, or it
   * would ask about input it has already saved.
   */
  dirty?: boolean;
}

/**
 * Dismissing a sheet with unsaved input asks first.
 *
 * Esc, a click outside or a swipe on the drawer used to close every form
 * sheet — tasks, events, habits, money — and drop what was typed. Closing
 * from the form itself (Save, Cancel) goes through the parent's own state, not
 * through here, so it is never asked about.
 */
function useDismissGuard(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  dirty?: boolean,
) {
  const confirm = useConfirm();
  const [touched, setTouched] = useState(false);
  const asking = useRef(false);
  const isDirty = dirty ?? touched;

  // A sheet opens clean.
  useEffect(() => {
    if (open) setTouched(false);
  }, [open]);

  useEffect(() => {
    if (!open || !isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, isDirty]);

  const handleOpenChange = async (next: boolean) => {
    if (next || !isDirty) return onOpenChange(next);
    if (asking.current) return;
    asking.current = true;
    const discard = await confirm({
      title: "Discard your changes?",
      description: "What you have entered here has not been saved.",
      confirmText: "Discard",
      cancelText: "Keep editing",
      variant: "destructive",
    });
    asking.current = false;
    if (discard) onOpenChange(false);
  };

  return { handleOpenChange, markTouched: () => setTouched(true) };
}

export default function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  wide = false,
  side = "right",
  dirty,
}: FormSheetProps) {
  const isMobile = useIsMobile();
  const { handleOpenChange, markTouched } = useDismissGuard(
    open,
    onOpenChange,
    dirty,
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent
          className="max-h-[90vh]"
          onInput={markTouched}
          onChange={markTouched}
        >
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description && (
              <DrawerDescription>{description}</DrawerDescription>
            )}
          </DrawerHeader>
          <ScrollArea className="flex-1 overflow-auto">
            <div className={cn("px-4 pb-4", className)}>{children}</div>
          </ScrollArea>
          {footer && (
            <div className="border-t p-4 mt-auto bg-background">{footer}</div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={side}
        onInput={markTouched}
        onChange={markTouched}
        className={cn(
          "flex flex-col",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
          side === "right" && "w-full",
        )}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className={cn("py-4", className)}>{children}</div>
        </ScrollArea>
        {footer && (
          <div className="border-t -mx-6 px-6 pt-4 mt-auto">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
