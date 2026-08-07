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
  amountDue?: number;
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
  frontImageUrl?: string | null;
  rearImageUrl?: string | null;
  driverCheckInImageUrl?: string | null;
  isLegacy?: boolean;
  totalSuccessfullyPaid?: number;
  prepaidAt?: string | null;
  graceExpiresAt?: string | null;
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Yêu cầu thất bại');
  }
  return response.data.data;
}

export async function checkoutLookupPlate(plate: string, pin?: string): Promise<CheckoutLookupResult> {
  try {
    const response = await api.get<{ success: boolean; data: CheckoutLookupResult }>(
      `/checkout/lookup/${encodeURIComponent(plate)}`,
      pin ? { params: { pin } } : {}
    );
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể tra cứu biển số. Vui lòng thử lại.';
    throw new Error(msg);
  }
}

export interface CheckoutLookupByPinResult extends CheckoutLookupResult {
  credentialType: 'GUEST_PIN' | 'MONTHLY_PIN';
}

export async function lookupCheckoutByPin(pin: string): Promise<CheckoutLookupByPinResult> {
  try {
    const response = await api.post<{ success: boolean; data: CheckoutLookupByPinResult }>(
      '/checkout/lookup-by-pin',
      { pin }
    );
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể tra cứu mã PIN. Vui lòng thử lại.';
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

export async function lookupCheckoutByMonthlyQr(qrToken: string): Promise<CheckoutLookupResult> {
  try {
    const response = await api.post<{ success: boolean; data: CheckoutLookupResult }>(
      '/checkout/lookup-monthly-qr',
      { qrToken }
    );
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Mã QR gói tháng không hợp lệ hoặc không còn hiệu lực. Vui lòng thử lại hoặc nhập mã PIN.';
    throw new Error(msg);
  }
}
