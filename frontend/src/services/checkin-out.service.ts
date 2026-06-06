import api from './api';
import type { CheckInRecord, ParkingSlot } from '../types';

interface CheckInResult {
  id: string;
  plateNumber: string;
  slot: ParkingSlot;
  checkInTime: string;
}

interface CheckOutResult {
  record: any;
  paymentRequired: boolean;
  amount?: number;
  durationHours?: number;
}

export const checkInOutService = {
  checkIn: async (data: { plateNumber: string; slotId?: string }) => {
    const response = await api.post<{ success: boolean; data: CheckInResult }>('/checkin-out/in', data);
    return response.data.data;
  },

  getActiveRecords: async () => {
    const response = await api.get<{ success: boolean; data: CheckInRecord[] }>('/checkin-out/active');
    return response.data.data;
  },

  checkOut: async (data: { plateNumber: string; paymentMethod: 'CASH' | 'CARD' | 'EWALLET' }) => {
    const response = await api.post<{ success: boolean; data: CheckOutResult }>('/checkin-out/out', data);
    return response.data.data;
  },
};
