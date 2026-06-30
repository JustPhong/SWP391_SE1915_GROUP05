import api from '../services/api';

export interface AvailabilityData {
  casual: {
    car: { available: number; total: number };
    motorbike: { available: number; total: number };
  };
  monthly: {
    car: { available: number; total: number };
    motorbike: { available: number; total: number };
  };
  total: { available: number; capacity: number };
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

/**
 * Public, no-auth. Uses the shared axios client which has baseURL '/api' and
 * only adds the Authorization header if a token exists in localStorage. For
 * unauthenticated visitors this request goes out with no token, which the
 * /public/availability endpoint accepts.
 */
export async function getPublicAvailability(): Promise<AvailabilityData> {
  const res = await api.get<ApiEnvelope<AvailabilityData>>('/public/availability');
  return res.data.data;
}