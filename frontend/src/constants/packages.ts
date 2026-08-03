export type VType = 'CAR' | 'MOTORBIKE';

export type TierType = 'VIP' | 'POPULAR' | 'REGULAR';

export interface PackagePlan {
  id: string;
  name: string;
  durationDays: number;
  allowedTier: TierType;
  prices: Partial<Record<VType, { price: number }>>;
}

export const getTierAreaLabel = (
  tier?: 'VIP' | 'POPULAR' | 'REGULAR' | null
): string => {
  switch (tier) {
    case 'VIP':
      return 'Khu VIP (Hạng VIP)';
    case 'POPULAR':
      return 'Khu Phổ biến (Hạng POPULAR)';
    case 'REGULAR':
      return 'Khu Cơ bản (Hạng REGULAR)';
    default:
      return 'Chưa xác định khu vực';
  }
};

export const getPackageTierTitle = (
  tier?: 'VIP' | 'POPULAR' | 'REGULAR' | null
): string => {
  switch (tier) {
    case 'REGULAR':
      return 'Gói Cơ bản';
    case 'POPULAR':
      return 'Gói Phổ biến';
    case 'VIP':
      return 'Gói VIP';
    default:
      return 'Gói tháng';
  }
};

export interface CasualTimeBlock {
  label: string;
  hours: string;
  price: string;
  unit: string;
  isNight?: boolean;
}

export interface CasualPlan {
  title: string;
  blocks: CasualTimeBlock[];
}


export const CASUAL_PRICING: Record<VType, CasualPlan> = {
  CAR: {
    title: 'Ô tô',
    blocks: [
      { label: 'Ban ngày', hours: '06:00 – 17:59', price: '15.000đ', unit: '/ 2 giờ' },
      { label: 'Buổi tối', hours: '18:00 – 23:59', price: '20.000đ', unit: '/ 2 giờ' },
      { label: 'Đêm muộn', hours: '00:00 – 05:59', price: '100.000đ', unit: 'trọn đêm', isNight: true },
    ],
  },
  MOTORBIKE: {
    title: 'Xe máy',
    blocks: [
      { label: 'Ban ngày', hours: '06:00 – 17:59', price: '3.000đ', unit: '/ 4 giờ' },
      { label: 'Ban đêm', hours: '18:00 – 05:59', price: '4.000đ', unit: '/ 4 giờ' },
    ],
  },
};