/** Sign-in with Google Identity Services (token flow): runs entirely in the browser, no server and no client secret. */
export const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}
interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}
interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type?: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

const google = () => (window as unknown as { google?: GoogleGlobal }).google;

let loading: Promise<void> | null = null;

export function loadGsi(): Promise<void> {
  if (google()) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('gsi-load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface Token {
  token: string;
  expiresAt: number;
}

/**
 * Asks Google for an access token. `prompt: ''` reuses an earlier consent without asking again (it still
 * needs a click in the app on most browsers); 'consent' shows the consent screen.
 */
export async function requestToken(clientId: string, prompt: '' | 'consent' | 'select_account'): Promise<Token> {
  await loadGsi();
  const g = google();
  if (!g) throw new Error('gsi-load');
  return new Promise<Token>((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.access_token) resolve({ token: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) || 3600) * 1000 });
        else reject(new Error(r.error || 'denied'));
      },
      error_callback: (e) => reject(new Error(e.type || 'denied')),
    });
    client.requestAccessToken({ prompt });
  });
}

export function revokeToken(token: string): void {
  try {
    google()?.accounts.oauth2.revoke(token);
  } catch {
    /* already invalid */
  }
}
