import { Response } from 'express';
import { checkinService } from '../services/checkin.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { slotSuggestionService } from '../services/slotSuggestion.service';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import path from 'path';
import fs from 'fs';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import prisma from '../config/db';

const checkinDir = path.join(__dirname, '../../uploads/checkin');

function cleanupFiles(urls: (string | undefined)[]) {
  for (const url of urls) {
    if (!url || typeof url !== 'string' || !url.startsWith('/uploads/checkin/')) {
      continue;
    }
    const filename = path.basename(url);
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      continue;
    }
    const filePath = path.join(checkinDir, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Cleanup] Deleted orphan checkin file: ${filePath}`);
      }
    } catch (err) {
      console.error(`[Cleanup] Failed to delete checkin file: ${filePath}`, err);
    }
  }
}

export const checkinController = {
  // GET /api/checkin/lookup/:plate
  lookup: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate } = req.params;
    const vehicleType = req.query.vehicleType as 'CAR' | 'MOTORBIKE' | undefined;
    const pin = req.query.pin as string | undefined;

    if (pin) {
      if (!/^\d{6}$/.test(pin)) {
        return res.status(400).json({ success: false, message: 'Mã PIN hoặc thông tin vé tháng không hợp lệ.' });
      }
      try {
        await monthlyPackageService.verifyMonthlyPackageAccessByPin(plate, pin);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || 'Mã PIN hoặc thông tin vé tháng không hợp lệ.' });
      }
    }

    const result = await checkinService.lookupPlate(plate, vehicleType);

    if (pin) {
      const verified = await monthlyPackageService.verifyMonthlyPackageAccessByPin(plate, pin);
      result.customerType = 'monthly';
      result.isExpired = false;
      result.allowedTier = verified.monthlyPackage.allowedTier;
      result.floorId = verified.monthlyPackage.floorId;
      result.floorName = verified.monthlyPackage.floor.name;
      result.floorCode = verified.monthlyPackage.floor.floorCode;
      result.isGuest = false;
      result.packageExpiry = verified.monthlyPackage.expiryDate.toISOString();
    }

    return res.status(200).json({ success: true, data: result });
  }),

  // GET /api/checkin/stats
  stats: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const result = await checkinService.getStats();
    return res.status(200).json({ success: true, data: result });
  }),

  // POST /api/checkin/precheck
  precheck: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate, vehicleType } = req.body;
    if (!plate || !vehicleType) {
      return res.status(400).json({ success: false, message: 'Biển số và loại xe là bắt buộc.' });
    }
    if (vehicleType !== 'CAR' && vehicleType !== 'MOTORBIKE') {
      return res.status(400).json({ success: false, message: 'Loại xe không hợp lệ.' });
    }
    const result = await checkinService.precheck(plate, vehicleType);
    return res.status(200).json({ success: true, data: result });
  }),

  // POST /api/checkin/monthly/verify-pin
  verifyMonthlyPin: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate, vehicleType, pin } = req.body;
    if (!plate || !vehicleType || !pin) {
      return res.status(400).json({ success: false, message: 'Biển số, loại xe và mã PIN là bắt buộc.' });
    }
    if (vehicleType !== 'CAR' && vehicleType !== 'MOTORBIKE') {
      return res.status(400).json({ success: false, message: 'Loại xe không hợp lệ.' });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'Mã PIN phải gồm đúng 6 chữ số.' });
    }

    const verified = await monthlyPackageService.verifyMonthlyPackageAccessByPin(plate, pin);
    const { vehicle, monthlyPackage: pkg } = verified;

    if (vehicle.type !== vehicleType) {
      return res.status(400).json({ success: false, message: 'Loại xe không khớp với gói tháng đăng ký.' });
    }

    const now = new Date();
    if (pkg.startDate.getTime() > now.getTime()) {
      return res.status(400).json({ success: false, message: 'Gói tháng chưa đến thời hạn bắt đầu sử dụng.' });
    }

    // Check existing active CheckInRecord for this vehicle
    const activeCheckIn = await prisma.checkInRecord.findFirst({
      where: {
        vehicleId: vehicle.id,
        checkOutTime: null,
        status: 'PARKING'
      }
    });
    if (activeCheckIn) {
      return res.status(400).json({ success: false, message: `Biển số ${vehicle.plateNumber} hiện đang có lượt gửi xe trong bãi.` });
    }

    return res.status(200).json({
      success: true,
      data: {
        verified: true,
        plate: vehicle.plateNumber,
        vehicleType: vehicle.type,
        floorName: pkg.floor.name,
        areaName: `Khu ${pkg.allowedTier === 'VIP' ? 'VIP' : pkg.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}`,
        allowedTier: pkg.allowedTier,
        endDate: pkg.expiryDate.toISOString()
      }
    });
  }),

  // POST /api/checkin
  submit: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate, vehicleType, customerType, floorId, slotCode, isMonthly } = req.body;

    let finalFloorId = floorId;
    let finalIsMonthly = isMonthly === 'true' || isMonthly === true;

    const monthlyAccessPin = req.body.monthlyAccessPin || req.body.pin;
    if (monthlyAccessPin) {
      if (!/^\d{6}$/.test(monthlyAccessPin)) {
        return res.status(400).json({ success: false, message: 'Mã PIN hoặc thông tin vé tháng không hợp lệ.' });
      }
      try {
        const verified = await monthlyPackageService.verifyMonthlyPackageAccessByPin(plate, monthlyAccessPin);
        finalFloorId = verified.monthlyPackage.floorId;
        finalIsMonthly = true;
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || 'Mã PIN hoặc thông tin vé tháng không hợp lệ.' });
      }
    }

    const parsedFloorId = Number(finalFloorId);
    if (!Number.isInteger(parsedFloorId) || parsedFloorId <= 0) {
      return res.status(400).json({ success: false, message: 'Khu vực đỗ xe không hợp lệ.' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const frontFile = files?.['frontImage']?.[0];
    const rearFile = files?.['rearImage']?.[0];
    const driverCheckInFile = files?.['driverCheckInImage']?.[0];

    // Backend Validation
    if (!driverCheckInFile) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ảnh người gửi xe trước khi xác nhận check-in.' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(driverCheckInFile.mimetype)) {
      return res.status(400).json({ success: false, message: 'Ảnh người gửi xe chỉ hỗ trợ định dạng JPG, PNG hoặc WEBP.' });
    }

    if (driverCheckInFile.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Ảnh người gửi xe không được vượt quá 5 MB.' });
    }

    let frontUrl: string | undefined = undefined;
    let rearUrl: string | undefined = undefined;
    let driverUrl: string | undefined = undefined;
    let frontPublicId: string | undefined = undefined;
    let rearPublicId: string | undefined = undefined;
    let driverPublicId: string | undefined = undefined;

    try {
      if (frontFile) {
        const uploadResult = await uploadBufferToCloudinary(frontFile.buffer);
        frontUrl = uploadResult.secureUrl;
        frontPublicId = uploadResult.publicId;
      }

      if (rearFile) {
        try {
          const uploadResult = await uploadBufferToCloudinary(rearFile.buffer);
          rearUrl = uploadResult.secureUrl;
          rearPublicId = uploadResult.publicId;
        } catch (err) {
          if (frontPublicId) {
            await deleteFromCloudinary(frontPublicId).catch(() => {});
          }
          throw err;
        }
      }

      if (driverCheckInFile) {
        try {
          const uploadResult = await uploadBufferToCloudinary(driverCheckInFile.buffer);
          driverUrl = uploadResult.secureUrl;
          driverPublicId = uploadResult.publicId;
        } catch (err) {
          if (frontPublicId) {
            await deleteFromCloudinary(frontPublicId).catch(() => {});
          }
          if (rearPublicId) {
            await deleteFromCloudinary(rearPublicId).catch(() => {});
          }
          throw err;
        }
      }

      const result = await checkinService.submit({
        plate,
        vehicleType,
        customerType: finalIsMonthly ? 'monthly' : customerType,
        floorId: parsedFloorId,
        slotCode: slotCode || null,
        isMonthly: finalIsMonthly,
        frontImageUrl: frontUrl || req.body.frontImageUrl,
        rearImageUrl: rearUrl || req.body.rearImageUrl,
        driverCheckInImageUrl: driverUrl,
        driverCheckInImagePublicId: driverPublicId,
        checkedInById: req.user?.id || null,
        monthlyAccessPin: monthlyAccessPin || null,
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (frontPublicId) {
        await deleteFromCloudinary(frontPublicId).catch(() => {});
      }
      if (rearPublicId) {
        await deleteFromCloudinary(rearPublicId).catch(() => {});
      }
      if (driverPublicId) {
        await deleteFromCloudinary(driverPublicId).catch(() => {});
      }
      throw error;
    }
  }),
  // GET /api/checkin/suggest?vehicleType=CAR&zone=CASUAL&top=3
suggest: asyncHandler(async (req: AuthRequest, res: Response) => {
  const vehicleType = (req.query.vehicleType as string) || 'CAR';
  const zone = (req.query.zone as 'MONTHLY' | 'CASUAL') || 'CASUAL';
  const top = parseInt(req.query.top as string) || 1;

  if (top > 1) {
    const slots = await slotSuggestionService.suggestTopSlots(vehicleType, zone, top);
    return res.status(200).json({ success: true, data: slots });
  }

  const slot = await slotSuggestionService.suggestSlot(vehicleType, zone);
  if (!slot) {
    return res.status(404).json({ success: false, message: 'Không còn slot trống phù hợp' });
  }
  return res.status(200).json({ success: true, data: slot });
}),
};
     