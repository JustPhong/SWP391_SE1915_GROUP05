import api from './api';
import type { Vehicle } from '../types';

export const vehicleService = {
  create: async (data: { plateNumber: string; type: 'MOTORBIKE' | 'CAR'; isMonthly?: boolean }) => {
    const response = await api.post<{ success: boolean; data: Vehicle }>('/vehicles', data);
    return response.data.data;
  },

  getMyVehicles: async () => {
    const response = await api.get<{ success: boolean; data: Vehicle[] }>('/vehicles/my');
    return response.data.data;
  },

  getByPlate: async (plateNumber: string) => {
    const response = await api.get<{ success: boolean; data: Vehicle }>(`/vehicles/${plateNumber}`);
    return response.data.data;
  },

  update: async (id: string, data: Partial<{ plateNumber: string; type: string }>) => {
    const response = await api.patch<{ success: boolean; data: Vehicle }>(`/vehicles/${id}`, data);
    return response.data.data;
  },

  remove: async (id: string) => {
    await api.delete(`/vehicles/${id}`);
  },
};
