import api from './api';
import type { AuthResponse, User } from '../types';

export const authService = {
  login: async (data: { email: string; password: string }) => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/login', data);
    return response.data.data;
  },

  register: async (data: {
    fullName: string;
    email: string;
    password: string;
    plateNumber: string;
    vehicleType: 'MOTORBIKE' | 'CAR';
  }) => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/register', {
      ...data,
      role: 'DRIVER',
    });
    return response.data.data;
  },

  me: async (): Promise<User> => {
    const response = await api.get<{ success: boolean; data: User }>('/auth/me');
    return response.data.data;
  },
};
