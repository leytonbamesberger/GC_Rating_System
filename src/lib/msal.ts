import { LogLevel, PublicClientApplication, type AccountInfo, type Configuration } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID as string | undefined;

export const isAuthConfigured = Boolean(clientId && tenantId);

// MSAL refuses an empty client ID, so an unconfigured build gets a placeholder; main.tsx shows a
// setup message instead of ever starting a sign-in in that case.
const PLACEHOLDER_CLIENT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Single-tenant authority: only accounts in Legacy Mechanical's Entra tenant can sign in.
 */
const msalConfig: Configuration = {
  auth: {
    clientId: clientId || PLACEHOLDER_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    // Process the response on the redirect page and stay there instead of hard-navigating back.
    navigateToLoginRequestUrl: false,
  },
  cache: { cacheLocation: 'localStorage' },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error('[msal]', message);
        else if (level === LogLevel.Warning) console.warn('[msal]', message);
      },
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = { scopes: ['openid', 'profile', 'email'] };

export function activeAccount(): AccountInfo | null {
  return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null;
}

/** Azure object ID: the stable per-tenant user id that gc_project_managers.azure_oid stores. */
export function accountOid(account: AccountInfo): string {
  return (account.idTokenClaims?.oid as string | undefined) ?? account.localAccountId;
}

/** Same fallback the gc-token function uses for the token's `email` claim. */
export function accountEmail(account: AccountInfo): string {
  return (account.idTokenClaims?.email as string | undefined) ?? account.username;
}

/** The signed-in user's Microsoft ID token (refreshed silently), or null if there isn't one. */
export async function getIdToken(): Promise<string | null> {
  const account = activeAccount();
  if (!account) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    return result.idToken;
  } catch (err) {
    console.error('[msal] could not acquire ID token:', err);
    return null;
  }
}
