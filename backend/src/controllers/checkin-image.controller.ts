import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import path from 'path';
import fs from 'fs';

const checkinDir = path.join(__dirname, '../../uploads/checkin');

export const checkinImageController = {
  // POST /api/checkin-media/upload-image
  upload: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Chưa chọn ảnh' });
    }

    const imageUrl = `/uploads/checkin/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      data: {
        imageUrl,
        filename: req.file.filename,
      },
    });
  }),

  // POST /api/checkin-media/delete-images
  deleteImages: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { urls } = req.body;
    if (!Array.isArray(urls)) {
      return res.status(400).json({ success: false, message: 'Danh sách URL không hợp lệ' });
    }

    const results = [];
    for (const url of urls) {
      if (typeof url !== 'string' || !url.startsWith('/uploads/checkin/')) {
        results.push({ url, deleted: false, reason: 'URL không hợp lệ' });
        continue;
      }
      const filename = path.basename(url);
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        results.push({ url, deleted: false, reason: 'Tên file không hợp lệ' });
        continue;
      }
      const filePath = path.join(checkinDir, filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          results.push({ url, deleted: true });
        } else {
          results.push({ url, deleted: false, reason: 'File không tồn tại' });
        }
      } catch (err: any) {
        results.push({ url, deleted: false, reason: err.message });
      }
    }

    return res.status(200).json({ success: true, results });
  }),
};