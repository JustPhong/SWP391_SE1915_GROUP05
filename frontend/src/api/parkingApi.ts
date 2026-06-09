import api from '../services/api';

export interface ParkingOverviewResponse {
  building: {
    totalFloors: number;
    totalSlots: number;
    occupied: number;
    available: number;
    overallOccupancy: number;
  };
  floors: Array<{
    floorCode: string;
    floorName: string;
    customerType: string;
    vehicleType: string;
    totalSlots: number;
    occupied: number;
    available: number;
    occupancyPercent: number;
  }>;
}

function unwrap<T>(response: { data: { success: boolean; data: T } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Lỗi không xác định');
  }
  return response.data.data;
}

export async function getParkingOverview(): Promise<ParkingOverviewResponse> {
  return unwrap(
    await api.get<{ success: boolean; data: ParkingOverviewResponse }>('/admin/parking')
  );
}
