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