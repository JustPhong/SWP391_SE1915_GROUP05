import api from '../services/api';

export interface StaffDashboardFloorSummary {
  floorId: number;
  floorCode: string;
  floorName: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  customerType: 'CASUAL' | 'MONTHLY';
  totalCapacity: number;
  activeParkingCount: number;
  physicalAvailableCapacity: number;
  activeBookingCount: number;
  receivableCapacity: number;
  occupancyPercent: number;
}

export interface StaffRecentActivity {
  id: string;
  plate: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  customerType: 'CASUAL' | 'MONTHLY';
  floorName: string;
  time: string;
  status: 'PARKING' | 'COMPLETED';
}

export interface DashboardData {
  totalCapacity: number;
  activeParkingCount: number;
  physicalAvailableCapacity: number;
  activeBookingCount: number;
  receivableCapacity: number;
  shiftCheckInCount: number;
  shiftCheckOutCount: number;
  floors: StaffDashboardFloorSummary[];
  recentActivities: StaffRecentActivity[];
}

function unwrap(response: { data: { success: boolean; data: DashboardData } }): DashboardData {
  if (!response.data.success) {
    throw new Error('Không thể tải dữ liệu tổng quan');
  }
  return response.data.data;
}

export async function getStaffDashboard(): Promise<DashboardData> {
  return unwrap(await api.get<{ success: boolean; data: DashboardData }>(`/dashboard/staff?_t=${Date.now()}`));
}
