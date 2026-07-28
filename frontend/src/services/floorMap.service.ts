import api from './api';
import type { Floor, ParkingSlot } from '../types/index';

export interface FloorWithSlots extends Floor {
  slots: ParkingSlot[];
}

export interface TierQuota {
  capacity: number;
  sold: number;
  remaining: number;
}

export type VehicleZoneQuotas = Record<'VIP' | 'POPULAR' | 'REGULAR' | string, TierQuota>;

export interface ZoneQuotaResponse {
  VIP: TierQuota;
  POPULAR: TierQuota;
  REGULAR: TierQuota;
  CAR: VehicleZoneQuotas;
  MOTORBIKE: VehicleZoneQuotas;
}

export interface MonthlyTierQuotaSummary {
  tier: 'VIP' | 'POPULAR' | 'REGULAR';
  limit: number;
  sold: number;
  remaining: number;
}

export interface MonthlyFloorQuotaSummary {
  floorId: number;
  quotas: MonthlyTierQuotaSummary[];
}

export const floorMapService = {
  getAllFloors: async (): Promise<Floor[]> => {
    const response = await api.get<{ success: boolean; data: Floor[] }>(`/floors?_t=${Date.now()}`);
    return response.data.data;
  },

  getSlotsByFloor: async (floorCode: string): Promise<FloorWithSlots> => {
    const response = await api.get<{ success: boolean; data: FloorWithSlots }>(`/floors/${floorCode}/slots?_t=${Date.now()}`);
    return response.data.data;
  },

  getFloorQuotas: async (floorId: number): Promise<MonthlyFloorQuotaSummary> => {
    const response = await api.get<{ success: boolean; data: MonthlyFloorQuotaSummary }>(
      `/monthly-packages/quotas/floor/${floorId}?_t=${Date.now()}`
    );
    return response.data.data;
  },

  getZoneQuotas: async (): Promise<ZoneQuotaResponse> => {
    const response = await api.get<{ success: boolean; data: ZoneQuotaResponse }>('/monthly-packages/quotas');
    return response.data.data;
  },
};
