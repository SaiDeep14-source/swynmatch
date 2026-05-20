import { auth } from './firebase';

export const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  // Wait for Firebase to initialize if it hasn't yet
  const getFreshToken = (): Promise<string | null> => {
    return new Promise((resolve) => {
      // If user is already available, get token directly
      if (auth.currentUser) {
        auth.currentUser.getIdToken(true).then(resolve).catch(() => resolve(null));
        return;
      }

      // Otherwise wait for the first auth state change
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        unsubscribe();
        if (user) {
          try {
            const token = await user.getIdToken(true);
            resolve(token);
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 5000);
    });
  };

  const token = await getFreshToken();
  if (token) {
    localStorage.setItem('auth_token', token); // Still keep for legacy components if needed
  }

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL;

export const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const getFreshToken = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (auth.currentUser) {
        auth.currentUser.getIdToken().then(resolve).catch(() => resolve(null));
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
  if (response.status === 401 || response.status === 403) {
    // Only reload if we are sure we are not in an infinite loop
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
