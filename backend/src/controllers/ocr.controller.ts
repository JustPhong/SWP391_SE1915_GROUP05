import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { AppError } from '../utils/helpers';
import { recognizeLicensePlate } from '../services/ocr.service';

export const ocrController = {
  // POST /api/checkin-media/ocr
  performOcr: asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new AppError(400, 'Ảnh biển số sau không hợp lệ. Vui lòng chọn ảnh JPG, JPEG, PNG hoặc WEBP.');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError(400, 'Ảnh biển số sau không hợp lệ. Vui lòng chọn ảnh JPG, JPEG, PNG hoặc WEBP.');
    }

    const vehicleType = String(req.body.vehicleType || 'CAR') as 'CAR' | 'MOTORBIKE';
    if (vehicleType !== 'CAR' && vehicleType !== 'MOTORBIKE') {
      throw new AppError(400, 'Loại xe không hợp lệ.');
    }

    const startTotal = Date.now();
    console.log(`[OCR] request started vehicleType=${vehicleType} file=${file.filename}`);

    try {
      const result = await recognizeLicensePlate(file.path, vehicleType);
      const durationMs = Date.now() - startTotal;
      console.log(`[OCR] success valid=true plate=${result.normalizedPlate} durationMs=${durationMs}`);

      return res.status(200).json({
        success: true,
        data: {
          plateNumber: result.candidates[0] || result.normalizedPlate || '',
          normalizedPlate: result.normalizedPlate || '',
          rawText: result.rawText,
          candidates: result.candidates,
          provider: result.provider,
          confidence: result.confidence,
          imageUrl: `/uploads/checkin/${file.filename}`,
        },
      });
    } catch (err) {
      const durationMs = Date.now() - startTotal;
      console.error(`[OCR] failed durationMs=${durationMs}`, err);
      throw err;
    }
  }),
};
