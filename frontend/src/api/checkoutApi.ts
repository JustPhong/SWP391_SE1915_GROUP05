import api from '../services/api';

export interface CheckoutLookupResult {
  found: boolean;
  recordId?: string;
  vehicleId?: string;
  plate?: string;
  vehicleType?: 'CAR' | 'MOTORBIKE';
  slotCode?: string;
  isMonthly?: boolean;
  checkInTime?: string;
  now?: string;
  durationMinutes?: number;
  fee?: number;
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
  packageExpiry?: string;
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Yêu cầu thất bại');
  }
  return response.data.data;
}

export async function checkoutLookupPlate(plate: string): Promise<CheckoutLookupResult> {
  try {
    const response = await api.get<{ success: boolean; data: CheckoutLookupResult }>(
      `/checkout/lookup/${encodeURIComponent(plate)}`
    );
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể tra cứu biển số. Vui lòng thử lại.';
    throw new Error(msg);
  }
}

export interface LostTicketPayload {
  plate: string;
  method: 'CASH' | 'CARD' | 'EWALLET';
}

export interface LostTicketResponse {
  recordId: string;
  paymentRequired: boolean;
  amountDue?: number;
  durationHours?: number;
  note?: string;
  fee?: number;
  depositCredit?: number;
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

export async function submitLostTicket(payload: LostTicketPayload): Promise<LostTicketResponse> {
  try {
    const response = await api.post<{ success: boolean; data: LostTicketResponse }>(
      '/checkout/lost-ticket',
      payload
    );
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể xử lý mất thẻ. Vui lòng thử lại.';
    throw new Error(msg);
  }
}
