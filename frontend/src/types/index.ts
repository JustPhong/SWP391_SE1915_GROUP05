export interface Vehicle {
  id: string;
  plateNumber: string;
  type: 'CAR' | 'MOTORBIKE';
  brand?: string;
  model?: string;
  color?: string;
  year?: number;
  seats?: number;
  isMonthly?: boolean;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  monthlyPackage?: {
    id: string;
    status: string;
    expiryDate: string;
    startDate?: string;
    planName?: string;
    price?: number;
    allowedTier?: string;
    slot?: any;
  };
}

export interface ParkingSlot {
  id: string;
  code: string;
  floor: {
    name: string;
    vehicleType: string;
    customerType: string;
  };
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'DRIVER';
export type VehicleType = 'MOTORBIKE' | 'CAR';