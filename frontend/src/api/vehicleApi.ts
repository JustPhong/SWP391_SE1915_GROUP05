import api from '../services/api';

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: 'CAR' | 'MOTORBIKE';
  ownerId: string;
  isMonthly: boolean;
  createdAt: string;
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Yêu cầu thất bại');
  }
  return response.data.data;
}

export async function getMyVehicles(): Promise<Vehicle[]> {
  try {
    const response = await api.get<{ success: boolean; data: Vehicle[] }>('/vehicles/my');
    return unwrap(response);
  } catch {
    return [];
  }
}

export async function addVehicle(data: { plateNumber: string; type: 'CAR' | 'MOTORBIKE'; isMonthly?: boolean; brand?: string; model?: string; color?: string; year?: number }): Promise<Vehicle> {
  try {
    const response = await api.post<{ success: boolean; data: Vehicle }>('/vehicles', data);
    return unwrap(response);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể thêm xe.';
    throw new Error(msg);
  }
}

export async function removeVehicle(id: string): Promise<void> {
  try {
    await api.delete(`/vehicles/${id}`);
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Không thể xoá xe.';
    throw new Error(msg);
  }
}
