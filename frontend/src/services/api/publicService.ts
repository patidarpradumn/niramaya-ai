import type {
  PublicFacility,
  PaginatedPublicFacilityResponse,
  CitizenAssistantResponse,
} from '../../types';

const API_BASE_URL = '/api/v1/public';

export const publicService = {
  /**
   * Get paginated public facilities with optional search, type, and service filters.
   */
  async getFacilities(params?: {
    search?: string;
    type?: string;
    service?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedPublicFacilityResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.type && params.type !== 'All Types') query.append('type', params.type);
    if (params?.service && params.service !== 'All Services') query.append('service', params.service);
    if (params?.page) query.append('page', String(params.page));
    if (params?.size) query.append('size', String(params.size));

    const res = await fetch(`${API_BASE_URL}/facilities?${query.toString()}`);
    if (!res.ok) {
      throw new Error('Failed to fetch public facilities');
    }
    return res.json();
  },

  /**
   * Find nearby facilities by latitude, longitude, and radius in km.
   */
  async getNearbyFacilities(params: {
    lat: number;
    lon: number;
    radius?: number;
    type?: string;
    service?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedPublicFacilityResponse> {
    const query = new URLSearchParams();
    query.append('lat', String(params.lat));
    query.append('lon', String(params.lon));
    query.append('radius', String(params.radius ?? 25.0));
    if (params.type && params.type !== 'All Types') query.append('type', params.type);
    if (params.service && params.service !== 'All Services') query.append('service', params.service);
    if (params.page) query.append('page', String(params.page));
    if (params.size) query.append('size', String(params.size));

    const res = await fetch(`${API_BASE_URL}/facilities/nearby?${query.toString()}`);
    if (!res.ok) {
      throw new Error('Failed to fetch nearby facilities');
    }
    return res.json();
  },

  /**
   * Get single public facility details.
   */
  async getFacilityById(id: number | string): Promise<PublicFacility> {
    const res = await fetch(`${API_BASE_URL}/facilities/${id}`);
    if (!res.ok) {
      throw new Error('Failed to fetch facility details');
    }
    return res.json();
  },

  /**
   * List all available public healthcare services across the network.
   */
  async getServices(): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/services`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [
        'Emergency',
        'Vaccination',
        'Maternity',
        'Pediatrics',
        'General Medicine',
        'Surgery',
        'ICU',
        'Pharmacy',
        'Laboratory',
        'Dental',
      ];
    }
  },

  /**
   * Send query to the grounded Citizen AI assistant.
   */
  async askCitizenAssistant(payload: {
    query: string;
    lat?: number;
    lon?: number;
    radius?: number;
    language?: string;
  }): Promise<CitizenAssistantResponse> {
    const res = await fetch(`${API_BASE_URL}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Citizen assistant service unavailable');
    }
    return res.json();
  },
};
