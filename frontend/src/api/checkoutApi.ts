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

export interface CheckoutCompletedResponse {
  ok: boolean;
  plate: string;
  slotCode: string | null;
  fee: number;
  isMonthly: boolean;
  checkOutTime: string;
  checkInTime: string;
  durationMinutes: number;
  floorName: string;
  floorCode: string;
  paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
  grossParkingFee: number;
  bookingDepositPaid: number;
  amountDue: number;
  breakdown?: Array<{
    label: string;
    minutesInBlock: number;
    lots: number;
    lotHours?: number;
    rate: number;
    amount: number;
    note?: string;
  }>;
}

export async function createCheckoutStripeSession(checkInRecordId: string): Promise<{ sessionId: string; checkoutUrl: string }> {
  try {
    const response = await api.post<{ success: boolean; data: { sessionId: string; checkoutUrl: string } }>(
      `/checkout/${checkInRecordId}/stripe-session`
    );
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể tạo phiên thanh toán Stripe. Vui lòng thử lại.';
    throw new Error(msg);
  }
}

export async function getCheckoutStripeStatus(checkInRecordId: string): Promise<{
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  checkInRecordStatus: string;
  receipt?: CheckoutCompletedResponse;
}> {
  try {
    const response = await api.get<{
      success: boolean;
      data: {
        status: 'PENDING' | 'SUCCESS' | 'FAILED';
        checkInRecordStatus: string;
        receipt?: CheckoutCompletedResponse;
      };
    }>(`/checkout/${checkInRecordId}/stripe-status`);
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể lấy trạng thái thanh toán Stripe. Vui lòng thử lại.';
    throw new Error(msg);
  }
}

export async function getCheckoutStripeStatusBySession(sessionId: string): Promise<{
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  checkInRecordStatus: string;
  receipt?: CheckoutCompletedResponse;
}> {
  try {
    const response = await api.get<{
      success: boolean;
      data: {
        status: 'PENDING' | 'SUCCESS' | 'FAILED';
        checkInRecordStatus: string;
        receipt?: CheckoutCompletedResponse;
      };
    }>(`/checkout/stripe-status`, {
      params: { session_id: sessionId },
    });
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể lấy trạng thái thanh toán Stripe. Vui lòng thử lại.';
    throw new Error(msg);
  }
}
