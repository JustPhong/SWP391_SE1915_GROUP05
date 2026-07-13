import api from './api';
import type { MonthlyPackage } from '../types';

export const monthlyPackageService = {
  create: async (data: {
    userId: string;
    vehicleId: string;
    slotId?: string;
    planId?: string;
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

  renewPackage: async (packageId: string) => {
    const response = await api.post<{ success: boolean; data: MonthlyPackage }>(
      `/monthly-packages/${packageId}/renew`
    );
    return response.data.data;
  },

  setAutoRenew: async (packageId: string, enabled: boolean) => {
    const response = await api.patch<{ success: boolean; data: MonthlyPackage }>(
      `/monthly-packages/${packageId}/auto-renew`,
      { enabled }
    );
    return response.data.data;
  },

  cancelPackage: async (packageId: string) => {
    const response = await api.post<{ success: boolean; data: MonthlyPackage }>(
      `/monthly-packages/${packageId}/cancel`
    );
    return response.data.data;
  },
};
