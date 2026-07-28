import api from '../services/api';
import { normalizePlateForLookup } from '../utils/plate';

// ─── Lookup ────────────────────────────────────────────────────────────────

export interface ActiveBookingSummary {
  id: string;
  floorId: number;
  floorName: string;
  floorCode: string;
  depositAmount: number;
  expiresAt: string;
}

export interface LookupResult {
  found: boolean;
  alreadyParked?: boolean;
  slotCode?: string;
  customerType: 'monthly' | 'casual' | 'booking';
  vehicleType?: 'CAR' | 'MOTORBIKE';
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  fixedSlot?: string | null;
  packageExpiry?: string;
  isExpired?: boolean;
  allowedTier?: string | null;
  // Floor information determined by backend lookup
  floorId?: number | null;
  floorName?: string | null;
  floorCode?: string | null;
  totalCapacity?: number | null;
  activeParkingCount?: number | null;
  activeBookingCount?: number | null;
  receivableCapacity?: number | null;
  // Active booking (CAR only)
  activeBooking?: ActiveBookingSummary | null;
  // Owner / customer info
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  note?: string | null;
}

// ─── Slots (legacy — still used by casual car flow if needed) ───────────────

export interface AvailableSlot {
  code: string;
  suggested: boolean;
}

// ─── Stats ────────────────────────────────────────────────────────────────

export interface CheckinStats {
  capacityUsed: number;
  capacityTotal: number;
  monthlyToday: number;
}

// ─── Submit ───────────────────────────────────────────────────────────────

export interface CheckinSubmitPayload {
  plateNumber: string;
  floorId: number;
  slotCode?: string | null;
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
  floorCode?: string;
  zoneName?: string | null;
  message?: string;
}

// ─── OCR ─────────────────────────────────────────────────────────────────

// ─── Image upload / delete ────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────

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

// ─── API functions ────────────────────────────────────────────────────────

/**
 * Look up a vehicle plate, optionally filtered by vehicleType (passed as query param).
 * Backend uses vehicleType to limit Booking lookup to CAR only.
 */
export async function lookupPlate(
  plate: string,
  vehicleType?: 'CAR' | 'MOTORBIKE'
): Promise<LookupResult> {
  try {
    const normalizedPlate = normalizePlateForLookup(plate);
    const response = await api.get<{ success: boolean; data: LookupResult }>(
      `/checkin/lookup/${encodeURIComponent(normalizedPlate)}`,
      vehicleType ? { params: { vehicleType } } : {}
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

export interface OcrApiResponse {
  plateNumber: string;
  normalizedPlate: string;
  rawText: string;
  candidates: string[];
  provider: 'TESSERACT_JS';
  confidence: number;
  reliability: 'VERIFIED' | 'REVIEW';
  agreementCount: number;
  imageUrl: string;
}

export async function runOcrApi(
  rearImage: File,
  vehicleType: 'CAR' | 'MOTORBIKE',
  signal?: AbortSignal
): Promise<OcrApiResponse> {
  const formData = new FormData();
  formData.append('image', rearImage);
  formData.append('vehicleType', vehicleType);

  const response = await api.post<{ success: boolean; data: OcrApiResponse }>(
    '/checkin-media/ocr',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
      signal,
    }
  );
  return unwrap(response);
}

export async function deleteCheckinImages(urls: string[]): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>('/checkin-media/delete-images', { urls });
  return response.data;
}

export async function submitCheckIn(
  payload: CheckinSubmitPayload
): Promise<CheckinSubmitResult> {
  try {
    const body: Record<string, unknown> = {
      plate: payload.plateNumber,
      vehicleType: payload.vehicleType,
      customerType: payload.isMonthly ? 'monthly' : 'casual',
      floorId: payload.floorId,
      slotCode: payload.slotCode ?? null,
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
