import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EventType, type AuthenticationResult } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import App from './App.tsx';
import { isAuthConfigured, msalInstance } from './lib/msal';
import './index.css';

function render() {
  createRoot(document.getElementById('root')!).render(
    // MsalProvider wraps StrictMode so StrictMode's double-invoked effects can't run MSAL's
    // redirect handling twice.
    <MsalProvider instance={msalInstance}>
      <StrictMode>
        <App />
      </StrictMode>
    </MsalProvider>
  );
}

function renderSetupMessage() {
  createRoot(document.getElementById('root')!).render(
    <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center px-6">
      <p className="max-w-md text-center text-white/70 text-sm">
        Sign-in is not configured. Set VITE_AZURE_CLIENT_ID and VITE_AZURE_TENANT_ID (see .env.example)
        and rebuild.
      </p>
    </div>
  );
}

if (!isAuthConfigured) {
  renderSetupMessage();
} else {
  // Anything touching the account cache has to wait for initialize() in msal-browser v3.
  msalInstance
    .initialize()
    .then(async () => {
      const existing = msalInstance.getAllAccounts();
      if (existing.length > 0) msalInstance.setActiveAccount(existing[0]);

      msalInstance.addEventCallback((event) => {
        if (
          (event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) &&
          event.payload &&
          'account' in event.payload &&
          event.payload.account
        ) {
          msalInstance.setActiveAccount((event.payload as AuthenticationResult).account);
        }
      });

      // Finish a sign-in redirect that is coming back to this page.
      const result = await msalInstance.handleRedirectPromise();
      if (result?.account) msalInstance.setActiveAccount(result.account);
    })
    .catch((err) => {
      console.error('[msal] startup failed:', err);
    })
    .finally(render);
}
