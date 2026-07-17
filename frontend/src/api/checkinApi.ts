import api from '../services/api';
import { formatPlateNumber } from '../utils/plate';


export interface LookupResult {
  found: boolean;
  alreadyParked?: boolean;
  slotCode?: string;
  customerType: 'monthly' | 'casual';
  vehicleType?: 'CAR' | 'MOTORBIKE';
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  fixedSlot?: string | null;
  packageExpiry?: string;
  isExpired?: boolean;
  // Owner / customer info
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  note?: string | null;
}

export interface AvailableSlot {
  code: string;
  suggested: boolean;
}

export interface CheckinStats {
  capacityUsed: number;
  capacityTotal: number;
  monthlyToday: number;
}

export interface CheckinSubmitPayload {
  plateNumber: string;
  slotCode?: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  isMonthly: boolean;
  frontImageUrl?: string;
  rearImageUrl?: string;
}

export interface CheckinSubmitResult {
  ok: boolean;
  slotCode: string;
  plate: string;
  checkInTime: string;
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

export async function lookupPlate(plate: string): Promise<LookupResult> {
  try {
    const normalizedPlate = formatPlateNumber(plate);
    const response = await api.get<{ success: boolean; data: LookupResult }>(
      `/checkin/lookup/${encodeURIComponent(normalizedPlate)}`
    );
    return unwrap(response);
  } catch (err: unknown) {

    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể tra cứu biển số. Vui lòng thử lại.';
    throw new Error(msg);
  }
}

export async function getAvailableSlots(
  vehicleType: 'CAR' | 'MOTORBIKE'
): Promise<AvailableSlot[]> {
  try {
    const response = await api.get<{ success: boolean; data: AvailableSlot[] }>(
      '/slots/available',
      { params: { vehicleType, customerType: 'CASUAL' } }
    );
    return unwrapList(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể tải danh sách slot trống.';
    throw new Error(msg);
  }
}

export async function getCheckinStats(): Promise<CheckinStats> {
  try {
    const response = await api.get<{ success: boolean; data: CheckinStats }>('/checkin/stats');
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể tải thống kê.';
    throw new Error(msg);
  }
}

export interface CheckinImageUploadPayload {
  image: File;
  plateNumber: string;
  recordId?: string;
}

export interface CheckinImageUploadResult {
  imageUrl: string;
  filename: string;
  plateNumber: string;
}

export async function uploadCheckinImage(
  payload: CheckinImageUploadPayload
): Promise<CheckinImageUploadResult> {
  const formData = new FormData();
  formData.append('image', payload.image);
  if (payload.recordId) formData.append('recordId', payload.recordId);
  formData.append('plateNumber', payload.plateNumber);

  const response = await api.post<{ success: boolean; data: CheckinImageUploadResult }>(
    '/checkin-media/upload-image',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return unwrap(response);
}

export async function submitCheckIn(
  payload: CheckinSubmitPayload
): Promise<CheckinSubmitResult> {
  try {
    const body: Record<string, unknown> = {
      plate: payload.plateNumber,
      vehicleType: payload.vehicleType,
      customerType: payload.isMonthly ? 'monthly' : 'casual',
      slotCode: payload.slotCode,
      isMonthly: payload.isMonthly,
    };
    if (payload.frontImageUrl) body.frontImageUrl = payload.frontImageUrl;
    if (payload.rearImageUrl) body.rearImageUrl = payload.rearImageUrl;
    const response = await api.post<{ success: boolean; data: CheckinSubmitResult }>(
      '/checkin',
      body
    );
    return unwrap(response);
  } catch (err: unknown) {
    const rawMsg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    const msg = rawMsg ?? 'Không thể check-in. Vui lòng thử lại.';
    throw new Error(msg);
  }
}
