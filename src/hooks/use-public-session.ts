import { useEffect, useState } from "react";
import { hasStoredSession } from "@/lib/rest";

/**
 * Whether this browser is signed in, for the public site's chrome — the
 * header's admin link and getting past the lockdown screen.
 *
 * Read from supabase-js's stored session rather than through supabase-js,
 * which would cost every visitor ~59 KB for a yes/no. Display only: every
 * access rule lives in the database. Admin screens use `useSupabaseSession`.
 */
export function usePublicSession(): { session: boolean; isLoading: boolean } {
  const [session, setSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const read = () => setSession(hasStoredSession());
    read();
    setIsLoading(false);
    // Signing in or out in another tab.
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  return { session, isLoading };
}
