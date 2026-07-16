import api from './api';
import type { Payment } from '../types/index';

export const paymentService = {
  record: async (data: {
    checkInRecordId?: string;
    monthlyPackageId?: string;
    amount: number;
    method: 'CASH' | 'CARD' | 'EWALLET';
    type: 'SESSION' | 'MONTHLY';
  }) => {
    const response = await api.post<{ success: boolean; data: Payment }>('/payments', data);
    return response.data.data;
  },

  getAll: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await api.get<{ success: boolean; data: Payment[] }>('/payments', { params });
    return response.data.data;
  },

  getVietQRConfig: async () => {
    const response = await api.get<{ success: boolean; data: { bankId: string; accountNo: string; accountName: string } }>('/payments/vietqr-config');
    return response.data.data;
  },
};

