import api from '../services/api';

export interface DashboardFloor {
  floorCode: string;
  name: string;
  occupied: number;
  capacity: number;
  percent: number;
}

export interface DashboardRecentCheckin {
  plate: string;
  vehicleType: string;
  slotCode: string;
  checkInTime: string;
  parked: boolean;
}

export interface DashboardData {
  vehiclesInLot: number;
  freeCar: number;
  freeMotorbike: number;
  totalSlots: number;
  checkedInToday: number;
  checkedOutToday: number;
  floors: DashboardFloor[];
  recentCheckins: DashboardRecentCheckin[];
}

function unwrap(response: { data: { success: boolean; data: DashboardData } }): DashboardData {
  if (!response.data.success) {
    throw new Error('Không thể tải dữ liệu tổng quan');
  }
  return response.data.data;
}

export async function getStaffDashboard(): Promise<DashboardData> {
  return unwrap(await api.get<{ success: boolean; data: DashboardData }>('/dashboard/staff'));
}
