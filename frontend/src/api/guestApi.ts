import api from '../services/api';

export interface GuestLookupResult {
  recordId: string;
  plate: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  checkInTime: string;
  durationMinutes: number;
  floorName: string;
  floorCode: string;
  totalFee: number;
  totalSuccessfullyPaid: number;
  additionalAmountDue: number;
  prepaidAt: string | null;
  graceExpiresAt: string | null;
  isGraceActive: boolean;
  breakdown: {
    label: string;
    amount: number;
    rate: number;
    lots: number;
    minutesInBlock: number;
    lotHours?: number;
    note?: string;
  }[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function lookupGuestVehicle(pin?: string, qrToken?: string): Promise<GuestLookupResult> {
  const payload: Record<string, string> = {};
  if (pin) payload.pin = pin;
  if (qrToken) payload.qrToken = qrToken;

  const res = await api.post<ApiEnvelope<GuestLookupResult>>('/public/guest/lookup', payload);
  return res.data.data;
}

export async function createGuestStripeSession(recordId: string, pin?: string, qrToken?: string): Promise<{ sessionId: string; checkoutUrl: string }> {
  const res = await api.post<ApiEnvelope<{ sessionId: string; checkoutUrl: string }>>('/public/guest/stripe-session', {
    recordId,
    ...(pin ? { pin } : {}),
    ...(qrToken ? { qrToken } : {}),
  });
  return res.data.data;
}

export async function getGuestStripeStatus(sessionId: string): Promise<{ status: string; checkInRecordStatus: string }> {
  const res = await api.get<ApiEnvelope<{ status: string; checkInRecordStatus: string }>>('/public/guest/stripe-status', {
    params: { session_id: sessionId },
  });
  return res.data.data;
}
