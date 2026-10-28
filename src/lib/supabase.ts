import { createClient } from '@supabase/supabase-js';
import { getIdToken } from './msal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Supabase does not accept Microsoft ID tokens directly (they carry no `role` claim), so the
// signed-in user's ID token is traded for a short-lived Supabase token at the gc-token edge
// function (supabase/functions/gc-token). That token carries role=authenticated and the user's
// Azure `oid`, which is what the RLS policies in supabase/gc_schema.sql check.
let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

async function exchangeToken(): Promise<string | null> {
  const idToken = await getIdToken();
  if (!idToken) {
    cached = null;
    return null;
  }

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/gc-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, apikey: supabaseAnonKey },
    });
  } catch (err) {
    console.error('[supabase] token exchange request failed:', err);
    return null;
  }
  if (!res.ok) {
    console.error(`[supabase] token exchange returned ${res.status}:`, await res.text().catch(() => ''));
    return null;
  }

  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

async function getSupabaseToken(): Promise<string | null> {
  // Reuse the token until a minute before it expires; share one exchange between concurrent queries.
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;
  inflight ??= exchangeToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Drop the cached Supabase token (call on sign-out). */
export function clearSupabaseToken() {
  cached = null;
}

// With `accessToken` set, supabase-js sends our token on every request and Supabase Auth is not used.
// When there is no token (signed out) it falls back to the anon key, which the gc_ tables deny.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: getSupabaseToken,
});

export type ProjectManager = {
  id: string;
  name: string;
  email: string | null;
  azure_oid: string | null;
  created_at: string;
};

export type GeneralContractor = {
  id: string;
  name: string;
  aliases: string | null;
  hit_rate_dollar: number | null;
  est_relationship: number | null;
  total_bids: number | null;
  total_bids_submitted_raw: number | null;
  created_at: string;
};

export type Rating = {
  id: string;
  gc_id: string;
  pm_id: string;
  job_number: string;
  job_name: string | null;
  payment_timeline: number | null;
  co_approval_timeline: number | null;
  co_negotiations: number | null;
  contract_terms: number | null;
  conflict_mitigation: number | null;
  schedule_trade_stacking: number | null;
  schedule_accuracy: number | null;
  site_control: number | null;
  relationship: number | null;
  safety: number | null;
  created_at: string;
};

export type RatingFormData = {
  job_number: string;
  job_name: string;
  gc_id: string;
  payment_timeline: number;
  co_approval_timeline: number;
  co_negotiations: number;
  contract_terms: number;
  conflict_mitigation: number;
  schedule_trade_stacking: number;
  schedule_accuracy: number;
  site_control: number;
  relationship: number;
  safety: number;
};

export type GCDashboardRow = {
  id: string;
  name: string;
  payment_timeline: number;
  co_approval_timeline: number;
  co_negotiations: number;
  contract_terms: number;
  conflict_mitigation: number;
  schedule_trade_stacking: number;
  schedule_accuracy: number;
  site_control: number;
  relationship: number;
  safety: number | null;
  overall_score: number;
  rating_count: number;
};
