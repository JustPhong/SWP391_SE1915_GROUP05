export type VType = 'CAR' | 'MOTORBIKE';

export interface PackagePlan {
  id: string;
  name: string;
  durationDays: number;
  prices: Record<VType, { price: number; priceLabel: string; pricePerDay: string }>;
}

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

export const PACKAGES: PackagePlan[] = [
  { id: '1m', name: 'Gói 1 tháng', durationDays: 30, prices: {
    CAR: { price: 1500000, priceLabel: '1.500.000đ', pricePerDay: '50.000đ/ngày' },
    MOTORBIKE: { price: 300000, priceLabel: '300.000đ', pricePerDay: '10.000đ/ngày' },
  }},
  { id: '3m', name: 'Gói 3 tháng', durationDays: 90, prices: {
    CAR: { price: 4000000, priceLabel: '4.000.000đ', pricePerDay: '44.444đ/ngày' },
    MOTORBIKE: { price: 800000, priceLabel: '800.000đ', pricePerDay: '8.889đ/ngày' },
  }},
  { id: '1y', name: 'Gói 1 năm', durationDays: 365, prices: {
    CAR: { price: 15000000, priceLabel: '15.000.000đ', pricePerDay: '41.096đ/ngày' },
    MOTORBIKE: { price: 3000000, priceLabel: '3.000.000đ', pricePerDay: '8.219đ/ngày' },
  }},
];

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