"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Download,
  Upload,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import {
  useGetMfaFactorsQuery,
  useGetSecuritySettingsQuery,
  useSignOutEverywhereMutation,
  useUnenrollMfaFactorMutation,
  useUpdateLockdownLevelMutation,
  useUpdateUserPasswordMutation,
} from "@/store/api/adminApi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { ManagerWrapper, PageHeader } from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import {
  LOCKDOWN_LEVELS,
  lockdownConfirmation,
  lockdownMeta,
} from "./lockdown";
import { assessPassword, passwordFormError } from "./password-strength";
import { AddFactorDialog } from "./add-factor-dialog";
import {
  exportWorkspace,
  parseBackup,
  restoreWorkspace,
} from "./workspace-export";
import { downloadText } from "@/lib/download";
import {
  SecurityHealth,
  healthRows,
  readLastBackup,
  recordBackup,
} from "./security-health";

/**
 * A settings-style section: what it is
 * and why on the left, the controls on the right at `lg`. `scroll-mt` keeps
 * the heading clear of the top bar when the status summary links here.
 */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-20 gap-4 rounded-surface border bg-card p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8"
    >
      <div>
        <h2 id={`${id}-title`} className="text-base font-medium">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  const confirm = useConfirm();
  const router = useRouter();

  const [addingFactor, setAddingFactor] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  // Restore: merge only, one transaction.
  const handleRestore = async (file: File) => {
    if (!supabase) return;
    setRestoreResult(null);
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      toast.error("Can't restore that file", { description: parsed.reason });
      return;
    }
    const ok = await confirm({
      title: "Restore from this backup?",
      description: `It holds ${parsed.rows} row${parsed.rows === 1 ? "" : "s"} across ${parsed.tables} table${parsed.tables === 1 ? "" : "s"}, from ${new Date(parsed.backup.exported_at).toLocaleString()}. Anything missing here is added back. Nothing that exists is changed or removed, so restoring twice is safe.`,
      confirmText: "Restore",
    });
    if (!ok) return;
    setRestoring(true);
    try {
      const added = await restoreWorkspace(supabase, parsed.backup);
      const total = Object.values(added).reduce((a, b) => a + b, 0);
      setRestoreResult(
        total === 0
          ? "Nothing to add: everything in the backup is already here."
          : `Added ${total} row${total === 1 ? "" : "s"}: ${Object.entries(
              added,
            )
              .filter(([, n]) => n > 0)
              .map(([t, n]) => `${t.replace(/_/g, " ")} ${n}`)
              .join(", ")}.`,
      );
      toast.success(total === 0 ? "Already up to date" : "Backup restored");
    } catch (err) {
      toast.error("Couldn't restore the backup", {
        description: `${getErrorMessage(err)} Nothing was changed.`,
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleExport = async () => {
    if (!supabase) return;
    setExportProgress("Starting…");
    try {
      const backup = await exportWorkspace(supabase, (done, total) =>
        setExportProgress(`Reading ${done} of ${total}…`),
      );
      downloadText(
        `workspace-${backup.exported_at.slice(0, 10)}.json`,
        JSON.stringify(backup, null, 2),
        "application/json",
      );
      recordBackup(backup.exported_at);
      setLastBackup(backup.exported_at);
      const failed = Object.keys(backup.errors);
      if (failed.length > 0) {
        toast.warning("Backup saved, with gaps", {
          description: `Couldn't read: ${failed.join(", ")}. The file lists why.`,
        });
      } else {
        toast.success("Backup saved");
      }
    } catch (err) {
      toast.error("Couldn't make the backup", {
        description: getErrorMessage(err),
      });
    } finally {
      setExportProgress(null);
    }
  };
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const {
    data: security,
    isLoading: isLoadingLevel,
    error: levelError,
  } = useGetSecuritySettingsQuery();
  // Kept in this browser only; the summary says so rather than implying
  // the server knows when you last took a copy.
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  useEffect(() => setLastBackup(readLastBackup()), []);
  const [updateLockdown, { isLoading: isLocking }] =
    useUpdateLockdownLevelMutation();
  const {
    data: factors = [],
    isLoading: isLoadingFactors,
    error: factorsError,
  } = useGetMfaFactorsQuery();
  const [unenrollFactor, { isLoading: isUnenrolling }] =
    useUnenrollMfaFactorMutation();
  const [updatePassword, { isLoading: isUpdatingPassword }] =
    useUpdateUserPasswordMutation();
  const [signOutEverywhere, { isLoading: isSigningOut }] =
    useSignOutEverywhereMutation();

  // `??` not `||`: 0 is a real level, and reaching for a fallback on it is the
  // habit that makes a security setting read as "off" when it is unset.
  const level = security?.lockdown_level ?? 0;
  const activeMeta = lockdownMeta(level);

  const verified = useMemo(
    () => factors.filter((f) => f.status === "verified"),
    [factors],
  );
  const assessment = useMemo(() => assessPassword(newPassword), [newPassword]);

  const health = healthRows({
    factors: {
      loading: isLoadingFactors,
      failed: !!factorsError,
      verified: verified.length,
    },
    site: { loading: isLoadingLevel, failed: !!levelError, level },
    lastBackup,
  });

  const handleLockdown = async (target: number) => {
    if (target === level) return;
    const { title, description, destructive } = lockdownConfirmation(target);

    const ok = await confirm({
      title,
      description,
      variant: destructive ? "destructive" : "default",
      confirmText: destructive ? "Lock it down" : "Change level",
    });
    if (!ok) return;

    try {
      await updateLockdown(target).unwrap();
      toast.success(`Site is now ${lockdownMeta(target).title.toLowerCase()}.`);
    } catch (err) {
      toast.error("Couldn't change the level", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleUnenroll = async (factorId: string) => {
    if (!supabase) return;

    const isLast = verified.length <= 1;
    const ok = await confirm({
      title: isLast
        ? "Remove your only 2FA method?"
        : "Remove this 2FA method?",
      description: isLast
        ? // Not "may lock you out" — admin access requires AAL2, so removing
          // the last factor stops every admin write immediately, and it is the
          // database that stops it.
          "Admin access requires two-factor authentication, so removing the last method signs you out and blocks every admin action until you enrol again."
        : "You will still have another method enrolled.",
      variant: "destructive",
      confirmText: "Remove",
    });
    if (!ok) return;

    try {
      await unenrollFactor(factorId).unwrap();
      toast.success("Two-factor method removed.");
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.currentLevel !== "aal2") router.push("/admin/login");
    } catch (err) {
      toast.error("Couldn't remove the method", {
        description: getErrorMessage(err),
      });
    }
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    const error = passwordFormError(newPassword, confirmPassword);
    setPasswordError(error ?? "");
    if (error) return;

    try {
      await updatePassword(newPassword).unwrap();
      toast.success("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = getErrorMessage(err);
      setPasswordError(message);
      toast.error("Couldn't update the password", { description: message });
    }
  };

  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sign out everywhere?",
      description:
        "Every signed-in browser is signed out, including this one. Use this if you think someone else has access.",
      confirmText: "Sign out everywhere",
    });
    if (!ok) return;

    try {
      await signOutEverywhere().unwrap();
      router.push("/admin/login");
    } catch (err) {
      toast.error("Couldn't sign out", { description: getErrorMessage(err) });
    }
  };

  return (
    <ManagerWrapper>
      <PageHeader
        title="Security"
        description="Who can reach the site, and what protects the account that runs it."
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <SecurityHealth rows={health} />

        {!!factorsError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden />
            <AlertDescription>
              Couldn&apos;t load your two-factor methods. The status below may
              be out of date.
            </AlertDescription>
          </Alert>
        )}

        <Section
          id="site-availability"
          title="Site availability"
          description="Who can reach the public site, and whether the database will accept changes."
        >
          <div
            role="radiogroup"
            aria-label="Site availability"
            className="flex flex-col gap-2"
          >
            {LOCKDOWN_LEVELS.map((option) => {
              const active = option.level === level;
              const Icon = option.icon;

              return (
                <button
                  key={option.level}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={isLocking}
                  onClick={() => handleLockdown(option.level)}
                  className={cn(
                    "flex items-start gap-3 rounded-surface border p-3 text-left transition-colors focus-ring",
                    active
                      ? "border-primary bg-secondary/40"
                      : "border-transparent hover:bg-secondary/50",
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-5 shrink-0",
                      option.tone === "critical" &&
                        active &&
                        "text-destructive",
                      option.tone === "warning" && active && "text-warning",
                      option.tone === "normal" && active && "text-success",
                      !active && "text-muted-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {option.title}
                      {active && (
                        <Check
                          aria-hidden
                          className="size-3.5 text-muted-foreground"
                        />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.summary}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/*
            The honest part. Maintenance is a client-side check on a static
            export — it hides the interface, not the data. Level 2's write
            block is restrictive RLS in db/schema.sql, so it holds
            only on a database that has had the current schema applied.
            A security screen that overstates what it does is worse than one
            that does less.
          */}
          <p className="mt-3 flex items-start gap-2 rounded-surface bg-secondary/50 p-3 text-xs text-muted-foreground">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {activeMeta.enforcement === "client" && (
                <>
                  Maintenance hides the site in the browser. The site is a
                  static export, so this conceals the interface rather than the
                  data — anything already public in the database stays readable
                  to someone who asks for it directly.
                </>
              )}
              {activeMeta.enforcement === "database" && (
                <>
                  The database refuses every admin write, including uploads,
                  while this level is set. Reads still work, and visitors can
                  still send messages. Requires the current{" "}
                  <code className="rounded bg-background px-1">
                    db/schema.sql
                  </code>{" "}
                  to have been run on your project. Changing the level is never
                  blocked, so lockdown cannot trap you.
                </>
              )}
              {activeMeta.enforcement === "none" && (
                <>
                  Everything is reachable. Maintenance hides the interface from
                  visitors; lockdown additionally refuses admin writes at the
                  database.
                </>
              )}
            </span>
          </p>
        </Section>

        <Section
          id="two-factor"
          title="Two-factor authentication"
          description="Required. Admin access is granted by the database only at AAL2, so this is the boundary rather than a convenience."
        >
          {isLoadingFactors ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : verified.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>
                No verified method. You will be asked to enrol one the next time
                you sign in, and admin writes are refused until you do.
              </AlertDescription>
            </Alert>
          ) : (
            <ul className="flex flex-col gap-2">
              {verified.map((factor) => (
                <li
                  key={factor.id}
                  className="flex flex-wrap items-center gap-3 rounded-surface bg-secondary/40 p-3"
                >
                  <Smartphone
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {factor.friendly_name || "Authenticator app"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Added{" "}
                      {factor.created_at
                        ? new Date(factor.created_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <ShieldCheck aria-hidden className="size-3.5" />
                    Verified
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isUnenrolling}
                    onClick={() => handleUnenroll(factor.id)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!isLoadingFactors && verified.length === 1 && (
            // Supabase has no recovery codes: a second factor is the only
            // way back in without the dashboard.
            <Alert className="mt-3">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>
                This is your only method. If you lose this device, getting back
                in means resetting it from the Supabase dashboard. Add a second
                one — another phone, or your password manager.
              </AlertDescription>
            </Alert>
          )}
          {!isLoadingFactors && verified.length > 0 && (
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => setAddingFactor(true)}
            >
              Add another method
            </Button>
          )}
          <AddFactorDialog
            open={addingFactor}
            onOpenChange={setAddingFactor}
            existingNames={factors.map((f) => f.friendly_name ?? "")}
          />
        </Section>

        <Section
          id="your-data"
          title="Your data"
          description="Everything you have written here, in one JSON file you keep. Secrets and visitor analytics are left out."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exportProgress !== null}
            >
              {exportProgress !== null ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="mr-2 size-4" aria-hidden />
              )}
              Download a backup
            </Button>
            <span role="status" className="text-xs text-muted-foreground">
              {exportProgress ??
                "The ledger also exports as CSV from Money → Transactions."}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" asChild disabled={restoring}>
              <label
                className={cn(
                  "cursor-pointer focus-within:ring-2 focus-within:ring-ring",
                  restoring && "pointer-events-none opacity-50",
                )}
              >
                {restoring ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="mr-2 size-4" aria-hidden />
                )}
                Restore from a backup
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  disabled={restoring}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleRestore(file);
                  }}
                />
              </label>
            </Button>
            <span role="status" className="text-xs text-muted-foreground">
              {restoreResult ??
                "Adds back what is missing; never changes or removes what is here."}
            </span>
          </div>
        </Section>

        <Section
          id="password"
          title="Password"
          description="The one account that can change anything on this site."
        >
          <form
            onSubmit={handlePasswordChange}
            className="flex flex-col gap-3"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            {/*
              Named gaps rather than a percentage. A meter that says "72%"
              invites tuning until the bar turns green; a specific missing
              thing is something the owner can act on.
            */}
            {newPassword && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-1 flex-1 gap-1"
                    role="meter"
                    aria-valuenow={assessment.score}
                    aria-valuemin={0}
                    aria-valuemax={4}
                    aria-label="Password strength"
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-full flex-1 rounded-full",
                          i < assessment.score
                            ? assessment.score >= 3
                              ? "bg-success"
                              : "bg-warning"
                            : "bg-secondary",
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {assessment.label}
                  </span>
                </div>
                {assessment.suggestions.length > 0 && (
                  <ul className="list-none space-y-0.5 text-xs text-muted-foreground">
                    {assessment.suggestions.map((suggestion) => (
                      <li key={suggestion}>· {suggestion}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {passwordError && (
              <p role="alert" className="text-sm text-destructive">
                {passwordError}
              </p>
            )}

            <Button
              type="submit"
              disabled={isUpdatingPassword || !newPassword}
              className="self-start"
            >
              {isUpdatingPassword ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="mr-2 size-4" aria-hidden />
              )}
              Update password
            </Button>
          </form>
        </Section>

        <Section
          id="sessions"
          title="Sessions"
          description="Sign out everywhere if you think someone else has access, or you signed in on a device you no longer have."
        >
          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <LogOut className="mr-2 size-4" aria-hidden />
            )}
            Sign out everywhere
          </Button>
        </Section>
      </div>
    </ManagerWrapper>
  );
}
