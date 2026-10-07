"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { useAppDispatch } from "@/store/hooks";
import { adminApi } from "@/store/api/admin/baseApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { TotpSecret } from "@/features/admin-auth/totp-secret";

type Enrolment = { factorId: string; qrCodeUrl: string; secret: string };

const DEFAULT_NAME = "Backup authenticator";

/**
 * Enrol another authenticator from Security.
 *
 * The page listed factors and could remove them but not add one, so a sole
 * owner with one phone had no backup short of the Supabase dashboard.
 * Supabase has no recovery codes; a second factor (another phone, or a
 * password manager's TOTP) is the recovery path.
 *
 * Name first, because Supabase requires factor names to be unique per user.
 * A factor abandoned half-way is unverified and grants nothing; it is removed
 * on cancel, and any left from an earlier attempt are cleared before a new
 * one starts, so they cannot pile up against the factor limit.
 */
export function AddFactorDialog({
  open,
  onOpenChange,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[];
}) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(DEFAULT_NAME);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const trimmed = name.trim();
  const taken = existingNames.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase(),
  );

  const reset = () => {
    setName(DEFAULT_NAME);
    setEnrolment(null);
    setCode("");
    setError("");
    setBusy(false);
  };

  const close = async () => {
    if (enrolment && supabase) {
      await supabase.auth.mfa.unenroll({ factorId: enrolment.factorId });
    }
    reset();
    onOpenChange(false);
  };

  const start = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !trimmed || taken) return;
    setBusy(true);
    setError("");

    const { data: listed } = await client.auth.mfa.listFactors();
    const stale = (listed?.all ?? []).filter(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    );
    await Promise.all(
      stale.map((f) => client.auth.mfa.unenroll({ factorId: f.id })),
    );

    const { data, error: enrollError } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: trimmed,
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message || "Couldn't start adding the method.");
      return;
    }
    setEnrolment({
      factorId: data.id,
      qrCodeUrl: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !enrolment) return;
    setBusy(true);
    setError("");
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolment.factorId,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setError(
        verifyError.message || "That code didn't match. Try the next one.",
      );
      setCode("");
      return;
    }
    dispatch(adminApi.util.invalidateTags(["MFA"]));
    toast.success(`"${trimmed}" added`, {
      description: "Either method now works when you sign in.",
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : void close())}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add another method</DialogTitle>
          <DialogDescription>
            A second authenticator (another phone, or your password manager)
            lets you in if you lose the first.
          </DialogDescription>
        </DialogHeader>

        {!enrolment ? (
          <form onSubmit={start} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="factor-name">Name</Label>
              <Input
                id="factor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={taken || undefined}
                aria-describedby={taken ? "factor-name-error" : undefined}
              />
              {taken && (
                <p id="factor-name-error" className="text-sm text-destructive">
                  A method already has this name.
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void close()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !trimmed || taken}>
                {busy ? "Starting…" : "Continue"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this with the new app.
            </p>
            <TotpSecret
              qrCodeUrl={enrolment.qrCodeUrl}
              secret={enrolment.secret}
            />
            <div className="space-y-2">
              <Label htmlFor="factor-code">The 6-digit code it shows</Label>
              <InputOTP
                id="factor-code"
                maxLength={6}
                value={code}
                onChange={setCode}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void close()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? "Checking…" : "Add method"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
