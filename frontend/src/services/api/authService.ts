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
  getStates: async (): Promise<Array<{ id: number; name: string; code: string }>> => {
    const res = await fetch(`${API_BASE_URL}/public/states`);
    return res.ok ? res.json() : [];
  },
  getDistricts: async (stateId?: number): Promise<Array<{ id: number; name: string; state_id: number }>> => {
    const url = stateId ? `${API_BASE_URL}/public/districts?state_id=${stateId}` : `${API_BASE_URL}/public/districts`;
    const res = await fetch(url);
    return res.ok ? res.json() : [];
  },
  getFacilitiesList: async (params?: { district_id?: number; state_id?: number }): Promise<Array<{ id: number; name: string; type: string; location: string; district_id: number }>> => {
    let url = `${API_BASE_URL}/public/facilities-list`;
    if (params?.district_id) {
      url += `?district_id=${params.district_id}`;
    } else if (params?.state_id) {
      url += `?state_id=${params.state_id}`;
    }
    const res = await fetch(url);
    return res.ok ? res.json() : [];
  },
};

