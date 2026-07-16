import api from './api';
import type { Floor, Booking, ParkingSlot } from '../types/index';

export interface FloorWithSlots extends Floor {
  slots: ParkingSlot[];
}

export const floorMapService = {
  getAllFloors: async (): Promise<Floor[]> => {
    const response = await api.get<{ success: boolean; data: Floor[] }>('/floors');
    return response.data.data;
  },

  getSlotsByFloor: async (floorCode: string): Promise<FloorWithSlots> => {
    const response = await api.get<{ success: boolean; data: FloorWithSlots }>(`/floors/${floorCode}/slots`);
    return response.data.data;
  },

  getActiveBookings: async (): Promise<Booking[]> => {
    const response = await api.get<{ success: boolean; data: Booking[] }>('/bookings/active');
    return response.data.data;
  },

  createBooking: async (data: {
    plateNumber: string;
    slotId: string;
    expectedArrival: string;
  }): Promise<Booking> => {
    const response = await api.post<{ success: boolean; data: Booking }>('/bookings', data);
    return response.data.data;
  },

  cancelBooking: async (bookingId: number): Promise<Booking> => {
    const response = await api.post<{ success: boolean; data: Booking }>(`/bookings/${bookingId}/cancel`);
    return response.data.data;
  },

  fulfillBooking: async (bookingId: number): Promise<Booking> => {
    const response = await api.post<{ success: boolean; data: Booking }>(`/bookings/${bookingId}/fulfill`);
    return response.data.data;
  },

  getZoneQuotas: async (): Promise<Record<string, { capacity: number; sold: number; remaining: number }>> => {
    const response = await api.get<{ success: boolean; data: any }>('/monthly-packages/quotas');
    return response.data.data;
  },
};
