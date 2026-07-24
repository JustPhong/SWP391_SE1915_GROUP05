import api from '../services/api';

export interface GuestCheckoutLookup {
  found: boolean;
  recordId?: string;
  plate?: string;
  vehicleType?: 'CAR' | 'MOTORBIKE';
  slotCode?: string;
  isMonthly?: boolean;
  checkInTime?: string;
  now?: string;
  durationMinutes?: number;
  fee?: number;
  prepaidFee?: number;
  amountDue?: number;
  graceExpiresAt?: string;
  breakdown?: {
    label: string;
    minutesInBlock: number;
    lots: number;
    lotHours: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  message?: string;
}

export interface GuestPrepayResult {
  ok: boolean;
  recordId: string;
  amountPaid: number;
  graceExpiresAt: string;
  remainingDue: number;
  message?: string;
}

export interface GuestConfirmExitResult {
  ok: boolean;
  recordId: string;
  fee: number;
  method: 'CASH' | 'CARD' | 'EWALLET';
  checkOutTime: string;
  breakdown?: {
    label: string;
    minutesInBlock: number;
    lots: number;
    lotHours: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Yêu cầu thất bại');
  }
  return response.data.data;
}

export async function lookupGuestCode(code: string): Promise<GuestCheckoutLookup> {
  const response = await api.get<{ success: boolean; data: GuestCheckoutLookup }>(
    `/public/guest-checkout/${encodeURIComponent(code)}`
  );
  return unwrap(response);
}

export async function prepayGuestCode(code: string, method: 'CASH' | 'CARD' | 'EWALLET'): Promise<GuestPrepayResult> {
  const response = await api.post<{ success: boolean; data: GuestPrepayResult }>(
    `/public/guest-checkout/${encodeURIComponent(code)}/prepay`,
    { method }
  );
  return unwrap(response);
}

export async function payOverstayGuestCode(code: string, method: 'CASH' | 'CARD' | 'EWALLET'): Promise<GuestPrepayResult> {
  const response = await api.post<{ success: boolean; data: GuestPrepayResult }>(
    `/public/guest-checkout/${encodeURIComponent(code)}/pay-overstay`,
    { method }
  );
  return unwrap(response);
}

export async function confirmGuestExit(code: string): Promise<GuestConfirmExitResult> {
  const response = await api.post<{ success: boolean; data: GuestConfirmExitResult }>(
    `/public/guest-checkout/${encodeURIComponent(code)}/confirm-exit`
  );
  return unwrap(response);
}