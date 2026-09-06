// NIRAMAYA AI — Alert Service
// API-ready integration contract
// Future endpoint: /api/alerts

import type { Alert } from '../../types';
import { mockAlerts } from '../mock/mockAlerts';

export const alertService = {
  /** Get all alerts */
  async getAlerts(): Promise<Alert[]> {
    // TODO: return fetch('/api/alerts').then(r => r.json());
    await new Promise(r => setTimeout(r, 200));
    return [...mockAlerts];
  },

  /** Mark an alert as reviewed */
  async markReviewed(alertId: string): Promise<void> {
    // TODO: return fetch(`/api/alerts/${alertId}/review`, { method: 'POST' }).then(r => r.json());
    await new Promise(r => setTimeout(r, 300));
    console.log(`[DEMO] Alert ${alertId} marked as reviewed`);
  },

  /** Get active critical alert count */
  async getCriticalCount(): Promise<number> {
    const alerts = await alertService.getAlerts();
    return alerts.filter(a => a.severity === 'Critical' && a.status === 'Active').length;
  },
};
