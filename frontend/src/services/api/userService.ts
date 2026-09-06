import type { User } from '../../types';

const API_BASE_URL = '/api/v1';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      if (response.status === 401) {
        localStorage.removeItem('access_token');
      }
      throw new Error(errorData.detail || 'Unauthorized');
    }
    throw new Error(errorData.detail || 'API request failed');
  }

  return response.json();
}

export const userAPI = {
  getPendingUsers: (): Promise<User[]> => fetchWithAuth('/users/pending'),
  approveUser: (id: string): Promise<User> => fetchWithAuth(`/users/${id}/approve`, { method: 'POST' }),
  rejectUser: (id: string): Promise<User> => fetchWithAuth(`/users/${id}/reject`, { method: 'POST' }),
};
