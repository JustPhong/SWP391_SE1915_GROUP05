import api from './api';
import type { MonthlyPackage, PackagePlan } from '../types/index';

export interface CheckoutSessionResult {
  status: 'CHECKOUT';
  packageId: string;
  paymentId: string;
  sessionId: string;
  url: string;
}

export interface AlreadyProcessedResult {
  status: 'ALREADY_PROCESSED';
  packageId: string;
  paymentId: string;
}

export type CheckoutResult = CheckoutSessionResult | AlreadyProcessedResult;

export const monthlyPackageService = {
  createCheckoutSession: async (data: {
    vehicleId: string;
    planId: string;
  }): Promise<CheckoutResult> => {
    try {
      const response = await api.post<{ success: boolean; data: CheckoutSessionResult }>(
        '/monthly-packages/checkout-session',
        data
      );
      return { ...response.data.data, status: 'CHECKOUT' };
    } catch (err: any) {
      if (
        err?.response?.status === 409 &&
        err?.response?.data?.alreadyProcessed === true
      ) {
        const d = err.response.data.data ?? {};
        return {
          status: 'ALREADY_PROCESSED',
          packageId: d.packageId ?? '',
          paymentId: d.paymentId ?? '',
        };
      }
      throw err;
    }
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

  renewPackage: async (packageId: string, selectedPlanId?: string): Promise<CheckoutResult> => {
    try {
      const response = await api.post<{ success: boolean; data: CheckoutSessionResult }>(
        `/monthly-packages/${packageId}/renew`,
        { selectedPlanId }
      );
      return { ...response.data.data, status: 'CHECKOUT' };
    } catch (err: any) {
      if (
        err?.response?.status === 409 &&
        err?.response?.data?.alreadyProcessed === true
      ) {
        const d = err.response.data.data ?? {};
        return {
          status: 'ALREADY_PROCESSED',
          packageId: d.packageId ?? '',
          paymentId: d.paymentId ?? '',
        };
      }
      throw err;
    }
  },

  abandonPayment: async (packageId: string, paymentId: string, sessionId: string) => {
    const response = await api.post<{ success: boolean; data: unknown }>(
      `/monthly-packages/${packageId}/abandon-payment`,
      { paymentId, sessionId }
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

  getPlans: async () => {
    const response = await api.get<{ success: boolean; data: PackagePlan[] }>('/monthly-packages/plans');
    return response.data.data;
  },
};
