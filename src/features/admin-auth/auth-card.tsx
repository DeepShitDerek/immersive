"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/**
 * The pieces every sign-in screen is built from.
 *
 * These are
 * the first screens a new owner sees, so they speak plainly and sit on the
 * page, not in a box.
 */

/** A sign-in screen: an optional first-run stepper, a title, then the form. */
export function AuthPanel({
  title,
  description,
  step,
  wide = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Where this screen sits in first-time setup, when it is part of it. */
  step?: number;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="auth-title"
      className={cn("w-full", wide ? "max-w-md" : "max-w-sm")}
    >
      {step !== undefined && <SetupSteps current={step} />}
      <h1
        id="auth-title"
        className={cn(
          "text-balance font-heading text-3xl font-semibold tracking-tight",
          step !== undefined && "mt-8",
        )}
      >
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-pretty text-muted-foreground">{description}</p>
      )}
      <div className="mt-8">{children}</div>
    </section>
  );
}

const FIRST_RUN = ["Account", "Email", "Two-factor", "Workspace"];

/** First-time setup, as four steps the new owner can see the end of. */
function SetupSteps({ current }: { current: number }) {
  return (
    <ol
      aria-label="Setting up your workspace"
      className="flex items-center gap-2"
    >
      {FIRST_RUN.map((label, index) => {
        const done = index < current;
        const here = index === current;
        return (
          <li
            key={label}
            aria-current={here ? "step" : undefined}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                done && "bg-primary text-primary-foreground",
                here && "bg-primary/15 text-primary ring-1 ring-primary",
                !done && !here && "bg-secondary text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </span>
            <span
              className={cn(
                here ? "font-medium text-foreground" : "text-muted-foreground",
                !here && "sr-only sm:not-sr-only",
              )}
            >
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
            {index < FIRST_RUN.length - 1 && (
              <span aria-hidden className="h-px w-3 bg-border sm:w-5" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A quiet line of help under a form. */
export function AuthNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** What went wrong, in the words the server gave, announced as an alert. */
export function AuthError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-control bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="min-w-0 break-words">{message}</p>
    </div>
  );
}

/** While the screen works out where the visitor belongs. */
export function AuthPending({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground"
    >
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
      {text}
    </div>
  );
}

/** A password field that can be shown, because typing blind is how typos lock people out. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  describedBy,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name="password"
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy}
        className="h-11 pr-11"
      />
      <button
        type="button"
        onClick={() => setShown((current) => !current)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-muted-foreground transition-colors hover:text-foreground focus-ring"
      >
        {shown ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
