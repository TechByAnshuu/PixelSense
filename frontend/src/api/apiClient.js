/**
 * apiClient.js
 *
 * Axios instance pre-configured with:
 *   - Base URL from environment
 *   - Request interceptor: automatically attaches the current Cognito JWT
 *     as the Authorization: Bearer <token> header
 *   - Response interceptor: handles 401 by signing the user out
 */

import axios from 'axios';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { API_BASE_URL } from '../auth/CognitoConfig';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ────────────────────────
apiClient.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();
    const token   = session.tokens?.idToken?.toString();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // No active session — request proceeds without auth header
    // (API Gateway will return 401 for protected routes)
  }
  return config;
});

// ── Response interceptor: handle 401 ───────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await signOut().catch(() => {});
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
