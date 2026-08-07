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

export interface PublicFeeRule {
  id: number;
  vehicleType: string;
  ruleType: string;
  label: string;
  startHour: number;
  endHour: number;
  blockMinutes: number | null;
  amount: number;
}

export async function getPublicFeeRules(): Promise<PublicFeeRule[]> {
  const res = await api.get<ApiEnvelope<PublicFeeRule[]>>('/public/fee-rules');
  return res.data.data;
}

export interface PublicBookingConfig {
  depositAmount: number;
}

export async function getPublicBookingConfig(): Promise<PublicBookingConfig> {
  const res = await api.get<ApiEnvelope<PublicBookingConfig>>('/public/booking-config');
  return res.data.data;
}