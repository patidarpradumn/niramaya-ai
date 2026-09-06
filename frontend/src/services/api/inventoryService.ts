// NIRAMAYA AI — Inventory Service
// API-ready integration contract
// Future endpoint: /api/inventory

import type { InventoryItem } from '../../types';
import { mockInventory } from '../mock/mockInventory';

export const inventoryService = {
  /** Get all inventory items with optional filters */
  async getInventory(filters?: {
    search?: string;
    riskLevel?: string;
    status?: string;
    facilityId?: string;
  }): Promise<InventoryItem[]> {
    // TODO: return fetch('/api/inventory?' + new URLSearchParams(filters)).then(r => r.json());
    await new Promise(r => setTimeout(r, 250));
    let results = [...mockInventory];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(i =>
        i.resourceName.toLowerCase().includes(q) ||
        i.facilityName.toLowerCase().includes(q)
      );
    }
    if (filters?.riskLevel && filters.riskLevel !== 'all') {
      results = results.filter(i => i.riskLevel === filters.riskLevel);
    }
    if (filters?.status && filters.status !== 'All') {
      results = results.filter(i => i.status === filters.status);
    }
    if (filters?.facilityId) {
      results = results.filter(i => i.facilityId === filters.facilityId);
    }
    return results;
  },

  /** Get expiry-critical items */
  async getExpiryRisks(): Promise<InventoryItem[]> {
    // TODO: return fetch('/api/inventory/expiry-risks').then(r => r.json());
    await new Promise(r => setTimeout(r, 200));
    return [...mockInventory].sort((a, b) => a.daysRemaining - b.daysRemaining);
  },
};
