import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { uploadCheckinImage } from '../middleware/upload.checkin.middleware';
import prisma from '../config/db';

export const checkinImageController = {
  // POST /api/checkin/upload-image
  upload: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Chưa chọn ảnh' });
    }

    const { recordId, plateNumber } = req.body;
    const imageUrl = `/uploads/checkin/${req.file.filename}`;

    // If recordId provided, update check-in record with image URLs
    if (recordId) {
      const record = await prisma.checkInRecord.findUnique({
        where: { id: recordId },
      });

      if (record) {
        // Update record with image path (you may want to add columns to schema)
        // For now, we'll just return the URL
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        imageUrl,
        filename: req.file.filename,
        plateNumber,
      },
    });
  }),
};