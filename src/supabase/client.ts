import {
  createClient,
  Session,
  SupabaseClient,
  SupabaseClientOptions,
} from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "@/lib/config";

const { supabase: supabaseConfig } = config;

const options: SupabaseClientOptions<"public"> = {};

// Export a safe client.
// If not configured, this will be null.
// All API calls must check if (supabase) before using it.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, options)
  : null;

export type { Session };
