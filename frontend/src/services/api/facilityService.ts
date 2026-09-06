// NIRAMAYA AI — API Service Layer
// API-ready integration contracts for backend connection
// Currently uses mock data. Replace mock imports with real API calls when backend is ready.

import type { Facility } from '../../types';
import { mockFacilities, mockFacilityStates, mockFacilityDistricts } from '../mock/mockFacilities';

// Future API endpoint: GET /api/facilities
// Future API endpoint: GET /api/facilities/:id
// Future API endpoint: GET /api/facilities?state=&district=&type=&status=

export const facilityService = {
  /** Get all facilities with optional filters */
  async getFacilities(filters?: {
    state?: string;
    district?: string;
    type?: string;
    status?: string;
  }): Promise<Facility[]> {
    // TODO: Replace with: return fetch('/api/facilities?' + new URLSearchParams(filters)).then(r => r.json());
    await new Promise(r => setTimeout(r, 300)); // Simulate network latency
    let results = [...mockFacilities];
    if (filters?.state && filters.state !== 'All States') {
      results = results.filter(f => f.state === filters.state);
    }
    if (filters?.district && filters.district !== 'All Districts') {
      results = results.filter(f => f.district === filters.district);
    }
    if (filters?.type && filters.type !== 'All Types') {
      results = results.filter(f => f.type === filters.type);
    }
    if (filters?.status && filters.status !== 'All Statuses') {
      results = results.filter(f => f.status === filters.status);
    }
    return results;
  },

  /** Get a single facility by ID */
  async getFacilityById(id: string): Promise<Facility | null> {
    // TODO: Replace with: return fetch(`/api/facilities/${id}`).then(r => r.json());
    await new Promise(r => setTimeout(r, 200));
    return mockFacilities.find(f => f.id === id) ?? null;
  },

  /** Get available states for filter */
  getStates(): string[] {
    return mockFacilityStates;
  },

  /** Get available districts for filter, optionally filtered by state */
  getDistricts(state?: string): string[] {
    if (state && state !== 'All States' && mockFacilityDistricts[state]) {
      return mockFacilityDistricts[state];
    }
    // Return all districts flat
    return Object.values(mockFacilityDistricts).flat();
  },
};
