// NIRAMAYA AI — Equipment Service
// API-ready integration contract
// Future endpoint: /api/equipment

import type { Equipment } from '../../types';
import { mockEquipment } from '../mock/mockData';

export const equipmentService = {
  /** Get all equipment */
  async getEquipment(filters?: { search?: string; status?: string }): Promise<Equipment[]> {
    // TODO: return fetch('/api/equipment?' + new URLSearchParams(filters)).then(r => r.json());
    await new Promise(r => setTimeout(r, 250));
    let results = [...mockEquipment];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.facilityName.toLowerCase().includes(q)
      );
    }
    if (filters?.status && filters.status !== 'All') {
      results = results.filter(e => e.status === filters.status);
    }
    return results;
  },

  /** Get equipment by facility */
  async getByFacility(facilityId: string): Promise<Equipment[]> {
    // TODO: return fetch(`/api/equipment?facilityId=${facilityId}`).then(r => r.json());
    await new Promise(r => setTimeout(r, 200));
    return mockEquipment.filter(e => e.facilityId === facilityId);
  },
};
