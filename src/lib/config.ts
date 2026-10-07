import { SESSION_MAX_AGE_MS, BUCKET_NAME } from "./constants";
import portfolioConfig from "../../portfolio.config";

/** Default site URL for fallback */
const DEFAULT_SITE_URL = "https://example.com";

export interface AppConfig {
  admin: Record<string, never>;
  mfa: {
    appName: string;
    issuer: string;
  };
  site: {
    title: string;
    description: string;
    url: string;
    author: string;
    twitterHandle?: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    bucketName: string;
  };
  session: {
    maxAge: number;
  };
}

export const config: AppConfig = {
  admin: {},
  mfa: {
    appName:
      process.env.NEXT_PUBLIC_APP_NAME || `${portfolioConfig.name} | Portfolio`,
    issuer:
      process.env.NEXT_PUBLIC_MFA_ISSUER || `${portfolioConfig.name} | MFA`,
  },
  site: {
    title:
      process.env.NEXT_PUBLIC_SITE_TITLE ||
      `${portfolioConfig.name} | Portfolio`,
    description:
      process.env.NEXT_PUBLIC_SITE_DESCRIPTION || portfolioConfig.description,
    url: process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
    author: portfolioConfig.name,
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    bucketName: BUCKET_NAME,
  },
  session: {
    maxAge: SESSION_MAX_AGE_MS,
  },
};

// --- CONFIGURATION VALIDATION ---
export const isSupabaseConfigured =
  !!config.supabase.url && !!config.supabase.anonKey;
