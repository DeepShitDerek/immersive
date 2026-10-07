import type { Metadata } from "next";
import { AuthShell } from "@/features/admin-auth/auth-shell";

export const metadata: Metadata = {
  robots: { index: false },
};

/**
 * The stage for the auth flow — no admin shell, no guard. `AuthShell` checks
 * that there is a database to sign in to before any screen is shown.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
