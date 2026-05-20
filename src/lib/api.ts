import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL;

export async function authFetch(path: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const finalUrl = path.startsWith('http')
    ? path
    : `${API_BASE}${path}`;

  return fetch(finalUrl, {
    ...options,
    headers
  });
}
