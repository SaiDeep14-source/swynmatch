export const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('auth_token');
    window.location.reload();
  }
  return response;
};
