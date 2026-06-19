  import { Response } from 'express';
  import prisma from '../config/db';
  import { asyncHandler } from '../utils/helpers';
  import { AuthRequest } from '../middleware/auth.middleware';

  export const slotController = {
    getAvailable: asyncHandler(async (req: AuthRequest, res: Response) => {
      const type = req.query.vehicleType as 'MOTORBIKE' | 'CAR' | undefined;
      const customerType = req.query.customerType as 'MONTHLY' | 'CASUAL' | undefined;

      if (type && customerType) {
        // Use the dedicated checkin service logic
        const { checkinService } = await import('../services/checkin.service');
        const slots = await checkinService.getAvailableSlots(type, customerType);
        return res.status(200).json({ success: true, data: slots });
      }

      // Fallback: original behaviour (vehicleType filter only)
      const where: Record<string, unknown> = { status: 'AVAILABLE' };
      if (type) where.type = type;

      const slots = await prisma.parkingSlot.findMany({
        where,
        orderBy: [{ floorId: 'asc' }, { code: 'asc' }],
      });
      return res.status(200).json({ success: true, data: slots });
    }),

    // GET /api/slots/all — all slots with floor info, grouped on client
    getAll: asyncHandler(async (_req: AuthRequest, res: Response) => {
      const slots = await prisma.parkingSlot.findMany({
        include: { floor: true },
        orderBy: [{ floor: { floorCode: 'asc' } }, { code: 'asc' }],
      });
      return res.status(200).json({ success: true, data: slots });
    }),

    // PATCH /api/slots/:id/status — Staff cập nhật trạng thái thủ công
  updateStatus: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status, reason } = req.body as { status: string; reason?: string };

    const VALID_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const slot = await prisma.parkingSlot.findUnique({ where: { id } });
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy slot' });
    }

    // Không cho đổi slot đang có xe đang đỗ thực sự về AVAILABLE thủ công
    if (status === 'AVAILABLE' && slot.status === 'OCCUPIED') {
      const activeSession = await prisma.checkInRecord.findFirst({
        where: { slotId: id, status: 'PARKING' },
      });
      if (activeSession) {
        return res.status(400).json({
          success: false,
          message: 'Slot đang có xe đỗ, không thể chuyển về AVAILABLE',
        });
      }
    }

    const updated = await prisma.parkingSlot.update({
      where: { id },
      data: { status },
      include: { floor: { select: { floorCode: true, name: true } } },
    });

    // Ghi audit log
    const { writeAuditLog, extractActor } = await import('../services/auditLog.service');
    const actor = await extractActor(req);
    await writeAuditLog({
      ...actor,
      action: 'slot.status_update',
      targetType: 'ParkingSlot',
      targetId: id,
      description: `Cập nhật slot ${slot.code} từ ${slot.status} → ${status}`,
      metadata: { slotCode: slot.code, from: slot.status, to: status, reason: reason ?? null },
    });

    return res.status(200).json({ success: true, data: updated });
  }),
  };
