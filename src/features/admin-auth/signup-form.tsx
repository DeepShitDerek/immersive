"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { supabase } from "@/supabase/client";
import { adminApi, useCheckAdminExistsQuery } from "@/store/api/adminApi";
import { useAppDispatch } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthError,
  AuthNote,
  AuthPanel,
  AuthPending,
  PasswordInput,
} from "./auth-card";
import {
  assessPassword,
  PASSWORD_MIN_LENGTH,
} from "@/features/security/password-strength";

/**
 * The first screen of a new install: create the one account the site will
 * ever have. If an owner already exists this redirects to sign-in — and the
 * database refuses further sign-ups regardless; this is the friendly half.
 */
export function SignupForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The rule Security applies when the password is changed. Sign-up
  // accepted Supabase's 6-character floor for the one account that controls
  // the whole site.
  const assessment = useMemo(() => assessPassword(password), [password]);

  const { data: adminExists, isLoading: isChecking } =
    useCheckAdminExistsQuery();

  useEffect(() => {
    // Not right after a successful signup: the "check your email" step has to
    // stay on screen.
    if (!isChecking && adminExists && !success) {
      router.replace("/admin/login");
    }
  }, [adminExists, isChecking, router, success]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Database connection missing. Cannot sign up.");
      return;
    }
    if (!assessment.acceptable) {
      setError(
        assessment.suggestions[0] ??
          `Use at least ${PASSWORD_MIN_LENGTH} characters`,
      );
      return;
    }
    setIsSubmitting(true);
    setError("");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setIsSubmitting(false);
      setError(signUpError.message);
      return;
    }

    // Success first, so the redirect effect above stays inert.
    setSuccess(true);
    setIsSubmitting(false);

    // Refresh the cached admin-exists answer for the sign-in page.
    dispatch(adminApi.util.invalidateTags(["System"]));

    // A project with email confirmation off signs you in at once; "check your
    // email" would send you looking for a message that never comes.
    if (data.session) router.replace("/admin/setup-mfa");
  };

  if ((isChecking || adminExists) && !success) {
    return <AuthPending text="One moment…" />;
  }

  if (success) {
    return (
      <AuthPanel
        step={1}
        title="Check your email"
        description="One click to confirm it's yours."
      >
        <div className="flex items-start gap-4 rounded-surface bg-card p-5 shadow-e1">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <strong className="break-all font-medium text-foreground">
              {email}
            </strong>
            . Open it, then come back and sign in — you&apos;ll set up
            two-factor next.
          </p>
        </div>
        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => router.push("/admin/login")}
        >
          Go to sign in
        </Button>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      step={0}
      title="Create your account"
      description="This site has no owner yet. The account you create here is the only one it will ever have."
    >
      <form className="space-y-5" onSubmit={handleSignup} noValidate>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={setPassword}
            describedBy="signup-password-hint"
          />
          <p
            id="signup-password-hint"
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {password && !assessment.acceptable
              ? assessment.suggestions[0]
              : password
                ? `${assessment.label}.${assessment.suggestions[0] ? ` ${assessment.suggestions[0]}.` : ""}`
                : `At least ${PASSWORD_MIN_LENGTH} characters. A long passphrase is easiest to remember.`}
          </p>
        </div>

        {error && <AuthError message={error} />}

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Creating your account…" : "Create account"}
        </Button>

        <AuthNote>
          Next: confirm your email, then turn on two-factor sign-in.
        </AuthNote>
      </form>
    </AuthPanel>
  );
}
