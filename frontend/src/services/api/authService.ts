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

export const authAPI = {
  getMe: (): Promise<User> => fetchWithAuth('/auth/me'),
  register: (data: any): Promise<User> => 
    fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
