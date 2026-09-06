// NIRAMAYA AI — Prediction & Recommendation Service
// API-ready integration contract
// Future endpoints: /api/predictions, /api/recommendations

import type { Recommendation, RecommendationStatus } from '../../types';
import {
  mockPredictionSummary,
  mockDemandData,
  mockAISynthesis,
  mockRecommendations,
} from '../mock/mockData';

export const predictionService = {
  /** Get prediction summary */
  async getPredictionSummary() {
    // TODO: return fetch('/api/predictions/summary').then(r => r.json());
    await new Promise(r => setTimeout(r, 300));
    return mockPredictionSummary;
  },

  /** Get demand forecast data */
  async getDemandForecast() {
    // TODO: return fetch('/api/predictions/demand').then(r => r.json());
    await new Promise(r => setTimeout(r, 300));
    return mockDemandData;
  },

  /** Get AI synthesis explanation */
  async getAISynthesis() {
    // TODO: return fetch('/api/predictions/synthesis').then(r => r.json());
    await new Promise(r => setTimeout(r, 400));
    return mockAISynthesis;
  },
};

export const recommendationService = {
  /** Get all redistribution recommendations */
  async getRecommendations(): Promise<Recommendation[]> {
    // TODO: return fetch('/api/recommendations').then(r => r.json());
    await new Promise(r => setTimeout(r, 300));
    return [...mockRecommendations];
  },

  /** Approve / reject / modify a recommendation */
  async updateStatus(id: string, status: RecommendationStatus, reviewedBy: string): Promise<void> {
    // TODO: return fetch(`/api/recommendations/${id}`, { method: 'PATCH', body: JSON.stringify({ status, reviewedBy }) });
    await new Promise(r => setTimeout(r, 500));
    console.log(`[DEMO] Recommendation ${id} updated to ${status} by ${reviewedBy}`);
  },
};
