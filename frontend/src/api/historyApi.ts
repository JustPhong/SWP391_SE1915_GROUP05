import api from '../services/api';

export interface ParkingHistoryDetail {
  id: string;
  recordType: 'CHECKIN';
  status: 'PARKING' | 'COMPLETED';
  isMonthly: boolean;
  isLostTicket: boolean;
  lostTicketReason?: string | null;
  lostTicketFullName?: string | null;
  lostTicketPhone?: string | null;
  allowedTier?: string | null;
  checkInTime: string;
  checkOutTime?: string | null;
  durationMinutes: number;

  vehicle: {
    id: string;
    plateNumber: string;
    type: 'CAR' | 'MOTORBIKE';
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
    seats?: number | null;
  };

  customerType: 'monthly' | 'booking' | 'casual';

  driver?: {
    id?: string;
    fullName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
  } | null;

  location: {
    floorId?: number | null;
    floorName?: string | null;
    floorCode?: string | null;
    slotCode?: string | null;
    parkingArea?: string | null;
  };

  checkInEvidence: {
    frontImageUrl?: string | null;
    rearImageUrl?: string | null;
    driverImageUrl?: string | null;
    driverFaceCapturedAt?: string | null;
  };

  checkOutEvidence: {
    frontImageUrl?: string | null;
    rearImageUrl?: string | null;
    driverImageUrl?: string | null;
  };

  payment: {
    totalAmount: number;
    payments: Array<{
      id: string;
      amount: number;
      method: string;
      type: string;
      status: string;
      paidAt?: string | null;
      transactionCode?: string | null;
      collectedBy?: string | null;
    }>;
  };

  checkedInBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;

  checkedOutBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;

  booking?: {
    id: string;
    depositAmount: number;
    depositStatus: string;
    bookingTime: string;
    expectedArrival: string;
  } | null;
}

export async function getParkingHistoryDetailApi(recordId: string): Promise<ParkingHistoryDetail> {
  const res = await api.get<{ success: boolean; data: ParkingHistoryDetail }>(
    `/checkin-out/history/${encodeURIComponent(recordId)}`
  );
  if (!res.data.success) {
    throw new Error((res.data as any).message || 'Không thể tải hồ sơ lượt gửi xe');
  }
  return res.data.data;
}
