"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase, type Session } from "@/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";

type GuardState = "checking" | "authorized" | "redirecting";

/**
 * Route protection for the (protected) admin group — the App Router successor
 * to the per-page `withAdminPage` guard. Enforces:
 *   static mode → toast + "/"; no session → login; AAL < aal2 → login;
 *   SIGNED_OUT → login.
 */
export function useAdminGuard(): {
  state: GuardState;
  session: Session | null;
} {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured || !supabase) {
      toast.error("Admin unavailable", {
        description: "The site is running in static mode (no database).",
      });
      router.replace("/");
      setState("redirecting");
      return;
    }

    const check = async () => {
      const {
        data: { session: current },
      } = await supabase!.auth.getSession();
      if (cancelled) return;

      if (!current) {
        router.replace("/admin/login");
        setState("redirecting");
        return;
      }

      const { data: aal } =
        await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;

      if (aal?.currentLevel !== "aal2") {
        router.replace("/admin/login");
        setState("redirecting");
        return;
      }

      setSession(current);
      setState("authorized");
    };

    check();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/admin/login");
        setState("redirecting");
      }
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, [router]);

  return { state, session };
}
