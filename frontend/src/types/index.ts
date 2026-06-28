export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'DRIVER';
export type VehicleType = 'MOTORBIKE' | 'CAR';
export type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
export type PackageStatus = 'ACTIVE' | 'EXPIRED';
export type BookingStatus = 'ACTIVE' | 'FULFILLED' | 'NO_SHOW' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'EWALLET';
export type PaymentType = 'SESSION' | 'MONTHLY';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: VehicleType;
  isMonthly: boolean;
  ownerId: string;
  owner?: User;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  createdAt: string;
}

export interface ParkingSlot {
  id: string;
  code: string;
  floorId: number;
  type: VehicleType;
  status: SlotStatus;
  isFixed: boolean;
  assignedVehicleId: string | null;
  createdAt: string;
  floor?: Floor;
}

export interface Floor {
  id: number;
  floorCode: string;
  name: string;
  vehicleType: VehicleType;
  customerType: 'MONTHLY' | 'CASUAL';
  capacity: number;
  slots?: ParkingSlot[];
  createdAt: string;
}

export interface MonthlyPackage {
  id: string;
  userId: string;
  vehicleId: string;
  slotId: string | null;
  startDate: string;
  expiryDate: string;
  price: number;
  status: PackageStatus;
  user?: User;
  vehicle?: Vehicle;
  slot?: ParkingSlot;
  payments?: Payment[];
  createdAt: string;
}

export interface Booking {
  id: number;
  vehicleId: string;
  slotId: string;
  bookingTime: string;
  expectedArrival: string;
  status: BookingStatus;
  createdById: string;
  vehicle?: Vehicle;
  slot?: ParkingSlot;
  createdBy?: User;
  createdAt: string;
}

export interface CheckInRecord {
  id: string;
  vehicleId: string;
  slotId: string;
  checkInTime: string;
  checkOutTime: string | null;
  isMonthly: boolean;
  vehicle?: Vehicle;
  slot?: ParkingSlot;
  createdAt: string;
}

export interface Payment {
  id: string;
  checkInRecordId: string | null;
  monthlyPackageId: string | null;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  type: PaymentType;
  checkInRecord?: CheckInRecord;
  monthlyPackage?: MonthlyPackage;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface OccupancyReport {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyRate: number;
  byFloor: FloorOccupancy[];
  byVehicleType: VehicleTypeOccupancy[];
}

export interface FloorOccupancy {
  floor: number;
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  occupancyRate: number;
}

export interface VehicleTypeOccupancy {
  type: string;
  total: number;
  available: number;
  occupied: number;
}

export interface RevenueReport {
  totalRevenue: number;
  sessionRevenue: number;
  monthlyRevenue: number;
  transactionCount: number;
  byMethod: Record<string, number>;
  byDay: { date: string; amount: number }[];
}
