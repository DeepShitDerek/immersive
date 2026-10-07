import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

/** A choice between two actions, plus a way out. */
interface ChoiceOptions extends ConfirmOptions {
  /** The second action, shown between Cancel and the confirm button. */
  alternativeText: string;
}

/** Which button was pressed; null when the dialog was cancelled or dismissed. */
export type Choice = "confirm" | "alternative" | null;

interface ConfirmDialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  choose: (options: ChoiceOptions) => Promise<Choice>;
}

const ConfirmDialogContext = createContext<
  ConfirmDialogContextType | undefined
>(undefined);

export function useConfirm() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return context.confirm;
}

export function useChoice() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useChoice must be used within a ConfirmDialogProvider");
  }
  return context.choose;
}

export const ConfirmDialogProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Partial<ChoiceOptions>>({});
  // A ref, so a dismissal and a button press cannot both resolve, and a
  // dialog opened over an unanswered one settles the first as cancelled.
  const resolver = useRef<((value: Choice) => void) | null>(null);

  const settle = useCallback((value: Choice) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOpen(false);
    resolve?.(value);
  }, []);

  const choose = useCallback((opts: Partial<ChoiceOptions>) => {
    resolver.current?.(null);
    setOptions({
      title: "Are you sure?",
      description: "This action cannot be undone.",
      confirmText: "Confirm",
      cancelText: "Cancel",
      variant: "default",
      ...opts,
    });
    setOpen(true);
    return new Promise<Choice>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const confirm = useCallback(
    async (opts: ConfirmOptions) => (await choose(opts)) === "confirm",
    [choose],
  );

  const buttonClass = "w-full sm:w-auto h-12 sm:h-10 text-base";

  return (
    <ConfirmDialogContext.Provider value={{ confirm, choose }}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(null);
        }}
      >
        {/* 
          RESPONSIVE UPDATE: 
          - w-[95vw]: Takes up 95% of viewport width on mobile (prevents edge touching)
          - max-w-lg: Caps width on desktop for readability
          - rounded-lg: Softer corners for mobile
        */}
        <AlertDialogContent className="w-[95vw] max-w-lg rounded-surface">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              {options.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground/90">
              {options.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* 
             RESPONSIVE FOOTER:
             - flex-col-reverse: Stacks buttons vertically on mobile (Cancel at bottom)
             - sm:flex-row: Reverts to horizontal on small tablets/desktop
             - gap-3: Adds space between stacked buttons
          */}
          <AlertDialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-2 mt-4">
            <AlertDialogCancel
              onClick={() => settle(null)}
              className={`mt-0 ${buttonClass}`}
            >
              {options.cancelText}
            </AlertDialogCancel>
            {options.alternativeText && (
              <AlertDialogAction
                onClick={() => settle("alternative")}
                className={`border border-input bg-background text-foreground hover:bg-accent ${buttonClass}`}
              >
                {options.alternativeText}
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={() => settle("confirm")}
              className={
                options.variant === "destructive"
                  ? `bg-destructive text-destructive-foreground hover:bg-destructive/90 ${buttonClass}`
                  : buttonClass
              }
            >
              {options.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDialogContext.Provider>
  );
};
