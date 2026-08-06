import api from '../services/api';

export interface CurrentSession {
  id: string;
  vehicleId: string;
  plateNumber: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  slotCode: string;
  floor: string | null;
  checkInTime: string;
  estimatedAmount: number | null;
  customerType: 'MONTHLY' | 'CASUAL';
  isMonthly: boolean;
  paymentStatus: 'UNPAID' | 'PENDING' | 'SUCCESS';
}

export interface MyPackage {
  id: string;
  planName: string;
  expiryDate: string;
  status: string;
}

export interface HistoryItem {
  id: string;
  plateNumber: string;
  slotCode: string;
  date: string;
  duration: string;
  amount: number;
  status: string;
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Yêu cầu thất bại');
  }
  return response.data.data;
}

export async function getCurrentSession(): Promise<CurrentSession[]> {
  try {
    const response = await api.get<{ success: boolean; data: CurrentSession[] }>(
      '/driver-dashboard/sessions/current'
    );
    return unwrap(response);
  } catch {
    return [];
  }
}

export async function getMyPackage(): Promise<MyPackage | null> {
  try {
    const response = await api.get<{ success: boolean; data: MyPackage | null }>(
      '/driver-dashboard/packages/my'
    );
    return unwrap(response);
  } catch {
    return null;
  }
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const response = await api.get<{ success: boolean; data: HistoryItem[] }>(
      '/driver-dashboard/history'
    );
    return response.data.data;
  } catch {
    return [];
  }
}
