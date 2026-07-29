import api from './api';
import type { OccupancyReport, RevenueReport } from '../types/index';

export const reportService = {
  getOccupancy: async (floor?: number) => {
    const response = await api.get<{ success: boolean; data: OccupancyReport }>('/reports/occupancy', {
      params: { floor },
    });
    return response.data.data;
  },

  getRevenue: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await api.get<{ success: boolean; data: RevenueReport }>('/reports/revenue', { params });
    return response.data.data;
  },

  getSummary: async () => {
    const response = await api.get<{
      success: boolean;
      data: { activeCheckIns: number; activeBookings: number; activePackages: number };
    }>('/reports/summary');
    return response.data.data;
  },

  getCurrentShift: async () => {
    const response = await api.get<{
      success: boolean;
      data: { shift: 'MORNING' | 'AFTERNOON' | 'NIGHT'; dateStr: string; start: string; end: string };
    }>('/reports/current-shift');
    return response.data.data;
  },

  getShiftActivity: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await api.get<{
      success: boolean;
      data: any[];
    }>('/reports/shift-activity', { params });
    return response.data.data;
  },
};
