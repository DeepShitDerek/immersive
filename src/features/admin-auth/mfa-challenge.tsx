"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabase/client";
import { useSignOutMutation } from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { AuthError, AuthPanel, AuthPending } from "./auth-card";

/** The 30-second window a code is valid for, as a ring that empties. */
function CodeWindow({ seconds }: { seconds: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r={radius}
          className="fill-none stroke-secondary"
          strokeWidth="3"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - seconds / 30)}
        />
      </svg>
      New code in{" "}
      <span className="font-medium tabular-nums text-foreground">
        {seconds}s
      </span>
    </p>
  );
}

/**
 * The second factor for an aal1 session with a verified TOTP factor. Submits
 * as soon as six digits are in.
 */
export function MfaChallenge() {
  const router = useRouter();
  const [signOut] = useSignOutMutation();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(true);
  const [remainingTime, setRemainingTime] = useState(30);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const protectPageAndGetFactor = async () => {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        router.replace("/admin/login");
        return;
      }

      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;

      if (aalError) {
        setError("Could not check MFA status: " + aalError.message);
        setIsBusy(false);
        return;
      }
      if (aalData?.currentLevel === "aal2") {
        router.replace("/admin");
        return;
      }
      if (aalData?.currentLevel !== "aal1" || aalData?.nextLevel !== "aal2") {
        router.replace("/admin/login");
        return;
      }

      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      if (factorsError || !factorsData?.totp?.length) {
        router.replace("/admin/login");
        return;
      }

      const firstVerifiedFactor = factorsData.totp.find(
        (f) => f.status === "verified",
      );
      if (!firstVerifiedFactor) {
        router.replace("/admin/setup-mfa");
        return;
      }

      setFactorId(firstVerifiedFactor.id);
      setIsBusy(false);
    };

    protectPageAndGetFactor();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // The 30-second TOTP window, aligned to the wall clock.
  useEffect(() => {
    const tick = () => setRemainingTime(30 - (new Date().getSeconds() % 30));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const verifyCode = async (code: string) => {
    if (!supabase || isBusy) return;
    if (!factorId) {
      setError("MFA factor is missing. Please try logging in again.");
      return;
    }
    setIsBusy(true);
    setError("");

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    setIsBusy(false);
    if (verifyError) {
      setError(verifyError.message || "Invalid code. Please try again.");
      setOtp("");
      return;
    }

    router.replace("/admin");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void verifyCode(otp);
  };

  const handleSignOut = async () => {
    setIsBusy(true);
    try {
      await signOut().unwrap();
    } catch {
      // Stranding someone on a half-signed-in page is worse than a stale session.
    }
    router.replace("/admin/login");
  };

  if (isBusy && !error && !factorId) {
    return <AuthPending text="Checking your sign-in…" />;
  }

  return (
    <AuthPanel
      title="Enter your code"
      description="From your authenticator app — it confirms it's you."
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <label htmlFor="mfa-challenge-otp" className="sr-only">
            Verification code
          </label>
          <InputOTP
            id="mfa-challenge-otp"
            maxLength={6}
            value={otp}
            onChange={(value) => setOtp(value)}
            onComplete={(value: string) => void verifyCode(value)}
            autoFocus
          >
            <InputOTPGroup className="w-full justify-center">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <CodeWindow seconds={remainingTime} />
        </div>

        {error && <AuthError message={error} />}

        <Button
          type="submit"
          size="lg"
          disabled={isBusy || otp.length !== 6 || !factorId}
          className="w-full"
        >
          {isBusy ? "Checking…" : "Verify"}
        </Button>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            className="text-sm text-muted-foreground"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </form>
    </AuthPanel>
  );
}
