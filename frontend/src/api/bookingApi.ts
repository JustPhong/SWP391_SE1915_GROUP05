import api from '../services/api';

export type BookingStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'NO_SHOW';

export interface BookingItem {
  id: string;
  status: BookingStatus;
  bookingTime: string;
  expectedArrival: string;
  depositAmount: string;
  depositStatus: string;
  slot: {
    id: string;
    code: string;
  };
  vehicle: {
    id: string;
    plateNumber: string;
    type: string;
    owner?: {
      id: string;
      fullName: string;
    } | null;
  };
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Yêu cầu thất bại');
  }
  return response.data.data;
}

function unwrapList<T>(response: { data: { success: boolean; data: T[]; message?: string } }): T[] {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Yêu cầu thất bại');
  }
  return response.data.data;
}

export async function listBookings(): Promise<BookingItem[]> {
  try {
    const response = await api.get<{ success: boolean; data: BookingItem[] }>('/bookings');
    return unwrapList(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể tải danh sách đặt chỗ.';
    throw new Error(msg);
  }
}

export async function fulfillBooking(id: string): Promise<BookingItem> {
  try {
    const response = await api.post<{ success: boolean; data: BookingItem }>(
      `/bookings/${id}/fulfill`
    );
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể xác nhận khách đến.';
    throw new Error(msg);
  }
}

export async function cancelBooking(id: string): Promise<BookingItem> {
  try {
    const response = await api.post<{ success: boolean; data: BookingItem }>(
      `/bookings/${id}/cancel`
    );
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể hủy đặt chỗ.';
    throw new Error(msg);
  }
}
