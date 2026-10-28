// gc-token: trades a Microsoft Entra ID token for a short-lived Supabase token.
//
// Supabase only trusts third-party tokens that carry `role: authenticated`, and Entra ID tokens
// cannot. So this function verifies the Entra ID token (signature against the tenant's keys, issuer,
// audience, tenant), then signs a Supabase-style JWT with role=authenticated, sub=<oid> and an
// `oid` claim, which supabase/gc_schema.sql reads with auth.jwt() ->> 'oid'.
//
// Secrets (Edge Functions -> Secrets; names cannot start with SUPABASE_):
//   GC_AZURE_TENANT_ID   Entra tenant (directory) ID
//   GC_AZURE_CLIENT_ID   Application (client) ID of the app registration the GC app signs in with
//   GC_JWT_SECRET        The project's legacy JWT secret (Project Settings -> JWT Keys). HS256 only.
//
// Deploy with JWT verification off, because the caller sends a Microsoft token, not a Supabase one:
//   supabase functions deploy gc-token --no-verify-jwt

import { createRemoteJWKSet, jwtVerify, SignJWT } from 'npm:jose@5';

const MAX_TTL_SECONDS = 3600;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return respond(405, { error: 'POST only' });

  const tenantId = Deno.env.get('GC_AZURE_TENANT_ID');
  const clientId = Deno.env.get('GC_AZURE_CLIENT_ID');
  const jwtSecret = Deno.env.get('GC_JWT_SECRET');
  if (!tenantId || !clientId || !jwtSecret) {
    return respond(500, { error: 'gc-token is not configured' });
  }

  const match = (req.headers.get('Authorization') ?? '').match(/^Bearer (.+)$/i);
  if (!match) return respond(401, { error: 'Missing bearer token' });

  jwks ??= createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));

  let claims;
  try {
    const { payload } = await jwtVerify(match[1], jwks, {
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      audience: clientId,
    });
    claims = payload;
  } catch (err) {
    return respond(401, { error: 'Invalid token', detail: err instanceof Error ? err.message : String(err) });
  }

  const oid = claims.oid as string | undefined;
  if (!oid) return respond(400, { error: 'Token has no oid claim' });
  if (claims.tid && claims.tid !== tenantId) return respond(403, { error: 'Token from unexpected tenant' });

  const now = Math.floor(Date.now() / 1000);
  // Never outlive the Microsoft token it was minted from.
  const exp = Math.min(now + MAX_TTL_SECONDS, claims.exp ?? now + MAX_TTL_SECONDS);

  const accessToken = await new SignJWT({
    role: 'authenticated',
    oid,
    email: (claims.email as string | undefined) ?? (claims.preferred_username as string | undefined),
    name: claims.name as string | undefined,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(oid)
    .setAudience('authenticated')
    .setIssuer('gc-token')
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(jwtSecret));

  return respond(200, { access_token: accessToken, expires_in: exp - now });
});
