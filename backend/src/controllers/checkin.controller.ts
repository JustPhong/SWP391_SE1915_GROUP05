import { Response } from 'express';
import { checkinService } from '../services/checkin.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { slotSuggestionService } from '../services/slotSuggestion.service';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import path from 'path';
import fs from 'fs';

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
    const result = await checkinService.lookupPlate(plate, vehicleType);
    return res.status(200).json({ success: true, data: result });
  }),

  // GET /api/checkin/stats
  stats: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const result = await checkinService.getStats();
    return res.status(200).json({ success: true, data: result });
  }),

  // POST /api/checkin
  submit: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate, vehicleType, customerType, floorId, slotCode, isMonthly } = req.body;

    const parsedFloorId = Number(floorId);
    if (!Number.isInteger(parsedFloorId) || parsedFloorId <= 0) {
      return res.status(400).json({ success: false, message: 'Khu vực đỗ xe không hợp lệ.' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const frontFile = files?.['frontImage']?.[0];
    const rearFile = files?.['rearImage']?.[0];

    let frontUrl: string | undefined = undefined;
    let rearUrl: string | undefined = undefined;
    let frontPublicId: string | undefined = undefined;
    let rearPublicId: string | undefined = undefined;

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

      const result = await checkinService.submit({
        plate,
        vehicleType,
        customerType,
        floorId: parsedFloorId,
        slotCode: slotCode || null,
        isMonthly: isMonthly === 'true' || isMonthly === true,
        frontImageUrl: frontUrl || req.body.frontImageUrl,
        rearImageUrl: rearUrl || req.body.rearImageUrl,
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (frontPublicId) {
        await deleteFromCloudinary(frontPublicId).catch(() => {});
      }
      if (rearPublicId) {
        await deleteFromCloudinary(rearPublicId).catch(() => {});
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
     