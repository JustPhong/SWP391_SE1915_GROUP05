import api from './api';
import type { MonthlyPackage } from '../types';

export const monthlyPackageService = {
  create: async (data: {
    userId: string;
    vehicleId: string;
    slotId?: string;
    startDate: string;
    expiryDate: string;
    price: number;
    paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
  }) => {
    const response = await api.post<{ success: boolean; data: MonthlyPackage }>('/monthly-packages', data);
    return response.data.data;
  },

  getActivePackages: async () => {
    const response = await api.get<{ success: boolean; data: MonthlyPackage[] }>('/monthly-packages/active');
    return response.data.data;
  },

  getMyPackages: async () => {
    const response = await api.get<{ success: boolean; data: MonthlyPackage[] }>('/monthly-packages/mine');
    return response.data.data;
  },

  getByVehicle: async (vehicleId: string) => {
    const response = await api.get<{ success: boolean; data: MonthlyPackage | null }>(
      `/monthly-packages/vehicle/${vehicleId}`
    );
    return response.data.data;
  },
};
