import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTH_ENDPOINTS = ['/auth/check', '/auth/enter'];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // A 401 from /auth/check or /auth/enter just means "wrong code" — let the
    // caller show that inline instead of treating it as an expired session.
    const isAuthAttempt = AUTH_ENDPOINTS.some((p) => err.config?.url?.includes(p));
    if (err.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('token');
      if (!location.pathname.startsWith('/enter')) {
        location.href = '/enter';
      }
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || fallback;
  }
  return fallback;
}
