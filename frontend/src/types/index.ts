export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'DRIVER';
export type VehicleType = 'MOTORBIKE' | 'CAR';
export type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
export type PackageStatus = 'ACTIVE' | 'EXPIRED';
export type BookingStatus = 'ACTIVE' | 'FULFILLED' | 'NO_SHOW' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'EWALLET';
export type PaymentType = 'MONTHLY' | 'SESSION' | 'BOOKING_FEE' | 'PARKING_FEE' | 'MONTHLY_PACKAGE';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';


export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
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
  seats?: number | null;
  createdAt: string;
  monthlyPackage?: {
    id: string;
    status: string;
    expiryDate: string;
    allowedTier?: 'VIP' | 'POPULAR' | 'REGULAR' | null;
    payments?: Array<{
      id: string;
      status: string;
    }>;
  } | null;
  checkInRecords?: any[];
  bookings?: any[];
  isCurrentlyParked?: boolean;
  hasActiveMonthlyPackage?: boolean;
}

export interface ParkingSlot {
  id: string;
  code: string;
  floorId: number;
  type: VehicleType;
  status: SlotStatus;
  isFixed: boolean;
  tier?: 'VIP' | 'POPULAR' | 'REGULAR';
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

  totalCapacity?: number;
  activeParkingCount?: number;
  physicalAvailableCapacity?: number;
  activeBookingCount?: number;
  receivableCapacity?: number;
  occupancyPercent?: number;
}

export interface MonthlyPackage {
  id: string;
  userId: string;
  vehicleId: string;
  floorId: number;
  planName?: string | null;
  autoRenew: boolean;
  startDate: string;
  expiryDate: string;
  price: number;
  status: PackageStatus;
  user?: User;
  vehicle?: Vehicle;
  floor?: Floor;
  payments?: Payment[];
  allowedTier?: 'VIP' | 'POPULAR' | 'REGULAR' | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  vehicleId: string;
  floorId: number;
  bookingTime: string;
  expectedArrival: string;
  status: BookingStatus;
  createdById: string;
  vehicle?: Vehicle;
  floor?: Floor;
  createdBy?: User;
  createdAt: string;
  depositAmount?: number | string;
  depositStatus?: string;
  expiresAt?: string | null;
  stripeCheckoutSessionId?: string | null;
  confirmedAt?: string | null;
  payments?: Payment[];
}

export interface CheckInRecord {
  id: string;
  vehicleId: string;
  slotId?: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  isMonthly: boolean;
  vehicle?: Vehicle;
  slot?: ParkingSlot | null;
  floorId?: number | null;
  floor?: {
    id: number;
    name: string;
    floorCode: string;
  } | null;
  allowedTier?: 'VIP' | 'POPULAR' | 'REGULAR' | null;
  bookingId?: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  checkInRecordId: string | null;
  monthlyPackageId: string | null;
  amount: number;
  method: PaymentMethod;
  paidAt?: string | null;
  type: PaymentType;
  status: PaymentStatus;
  transactionCode?: string | null;
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
