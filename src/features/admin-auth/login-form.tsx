"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabase/client";
import { useCheckAdminExistsQuery } from "@/store/api/adminApi";
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

/**
 * Routes an authenticated session to the right admin destination based on
 * its Authenticator Assurance Level. This table is the security contract: an
 * aal1 session never reaches /admin.
 */
async function routeByAssuranceLevel(replace: (href: string) => void) {
  if (!supabase) return;
  const { data: aalData, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(error.message || "Could not verify MFA status.");

  if (aalData.currentLevel === "aal2") {
    replace("/admin");
  } else if (aalData.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
    replace("/admin/mfa-challenge");
  } else {
    replace("/admin/setup-mfa");
  }
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // A fresh install has no owner yet: send the visitor to the one-time signup.
  const { data: adminExists, isLoading: isCheckingAdmin } =
    useCheckAdminExistsQuery();

  useEffect(() => {
    if (!isCheckingAdmin && adminExists === false) {
      router.replace("/admin/signup");
    }
  }, [adminExists, isCheckingAdmin, router]);

  // Already-authenticated sessions skip the form and route by AAL.
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      if (cancelled) return;

      if (session) {
        setIsRedirecting(true);
        try {
          await routeByAssuranceLevel((href) => {
            if (!cancelled) router.replace(href);
          });
        } catch {
          if (!cancelled) setIsRedirecting(false);
        }
      }
    };

    redirectIfAuthenticated();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Database connection missing. Cannot log in.");
      return;
    }
    setIsSubmitting(true);
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password },
    );

    if (signInError) {
      setIsSubmitting(false);
      setError(signInError.message || "Invalid login credentials.");
      return;
    }

    if (!data.session) {
      setIsSubmitting(false);
      setError("Login failed. Please try again.");
      return;
    }

    try {
      await routeByAssuranceLevel((href) => router.replace(href));
    } catch (aalError) {
      setIsSubmitting(false);
      setError(
        aalError instanceof Error
          ? aalError.message
          : "Could not verify MFA status.",
      );
    }
  };

  if (isCheckingAdmin) return <AuthPending text="One moment…" />;
  if (isRedirecting)
    return <AuthPending text="You're signed in — opening your workspace…" />;

  return (
    <AuthPanel
      title="Sign in"
      description="to your workspace. You'll confirm it's you with your authenticator app next."
    >
      <form className="space-y-5" onSubmit={handleLogin} noValidate>
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
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
          <Label htmlFor="login-password">Password</Label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
        </div>

        {error && <AuthError message={error} />}

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>

        <AuthNote>
          Forgotten your password? Reset it from your Supabase dashboard under
          Authentication → Users.
        </AuthNote>
      </form>
    </AuthPanel>
  );
}
