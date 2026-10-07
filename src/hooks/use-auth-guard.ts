import { useEffect, useState } from "react";
import { supabase, Session } from "@/supabase/client";

/**
 * Read-only session state for display purposes (user email, avatar).
 * No redirects and no MFA check — route protection is `useAdminGuard`
 * (src/features/admin-shell), which the (protected) layout runs once. Use
 * this in shell chrome (sidebar, topbar) so the guard isn't duplicated.
 */
export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return { session, isLoading };
}
