import api from './api';
import type { Booking } from '../types';

export const bookingService = {
  create: async (data: { vehicleId: string; slotId?: string; expiresAt: string }) => {
    const response = await api.post<{ success: boolean; data: Booking }>('/bookings', data);
    return response.data.data;
  },

  cancel: async (bookingId: string) => {
    const response = await api.post<{ success: boolean; data: Booking }>(`/bookings/${bookingId}/cancel`);
    return response.data.data;
  },

  getActiveBookings: async () => {
    const response = await api.get<{ success: boolean; data: Booking[] }>('/bookings/active');
    return response.data.data;
  },

  getByVehicle: async (vehicleId: string) => {
    const response = await api.get<{ success: boolean; data: Booking[] }>(`/bookings/vehicle/${vehicleId}`);
    return response.data.data;
  },

  suggestSlot: async (vehicleType: 'MOTORBIKE' | 'CAR') => {
    const response = await api.get<{ success: boolean; data: any }>('/bookings/suggest', {
      params: { vehicleType },
    });
    return response.data.data;
  },

  getAvailableSlots: async (vehicleType: 'MOTORBIKE' | 'CAR') => {
    const response = await api.get<{ success: boolean; data: any[] }>('/bookings/available', {
      params: { vehicleType },
    });
    return response.data.data;
  },
};
