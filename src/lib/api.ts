import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL;

export const authFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
) => {
  const getFreshToken = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (auth.currentUser) {
        auth.currentUser
          .getIdToken()
          .then(resolve)
          .catch(() => resolve(null));
        return;
      }

      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        unsubscribe();

        if (user) {
          try {
            const token = await user.getIdToken();
            resolve(token);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 5000);
    });
  };

  const token = await getFreshToken();

  if (token) {
    localStorage.setItem('auth_token', token);
  }

  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url =
    typeof input === 'string'
      ? `${API_BASE}${input}`
      : input;

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    const lastReload = sessionStorage.getItem('last_auth_reload');
    const now = Date.now();

    if (!lastReload || now - parseInt(lastReload) > 10000) {
      sessionStorage.setItem('last_auth_reload', now.toString());
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_email');
      window.location.reload();
    }
  }

  return response;
};
