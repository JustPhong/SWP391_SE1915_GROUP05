import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { AppError } from '../utils/helpers';
import { recognizeLicensePlate, reconcilePlates } from '../services/ocr.service';

export const ocrController = {
  // POST /api/checkin-media/ocr
  performOcr: asyncHandler(async (req: AuthRequest, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const frontFile = files?.frontImage?.[0];
    const rearFile = files?.rearImage?.[0] || files?.image?.[0] || req.file;

    if (!frontFile && !rearFile) {
      throw new AppError(400, 'Không tìm thấy dữ liệu ảnh để nhận diện.');
    }

    const vehicleType = String(req.body.vehicleType || 'CAR') as 'CAR' | 'MOTORBIKE';
    if (vehicleType !== 'CAR' && vehicleType !== 'MOTORBIKE') {
      throw new AppError(400, 'Loại xe không hợp lệ.');
    }

    const startTotal = Date.now();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OCR] request started front=${frontFile?.originalname || 'NONE'} rear=${rearFile?.originalname || 'NONE'} vehicleType=${vehicleType}`);
    }

    let frontResult = null;
    let rearResult = null;
    let lastError: Error | null = null;

    if (vehicleType === 'MOTORBIKE') {
      if (rearFile) {
        try {
          rearResult = await recognizeLicensePlate(rearFile.buffer, 'MOTORBIKE');
        } catch (err) {
          lastError = err as Error;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[OCR][MOTORBIKE] Rear image OCR failed:', err);
          }
        }
      }
    } else {
      if (frontFile) {
        try {
          frontResult = await recognizeLicensePlate(frontFile.buffer, vehicleType);
        } catch (err) {
          lastError = err as Error;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[OCR] Front image OCR failed:', err);
          }
        }
      }

      if (rearFile) {
        try {
          rearResult = await recognizeLicensePlate(rearFile.buffer, vehicleType);
        } catch (err) {
          lastError = err as Error;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[OCR] Rear image OCR failed:', err);
          }
        }
      }
    }

    if (!frontResult && !rearResult) {
      throw lastError || new AppError(422, 'Không nhận diện được biển số. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.');
    }

    const reconciliation = reconcilePlates(
      frontResult?.normalizedPlate || '',
      frontResult?.confidence || 0,
      rearResult?.normalizedPlate || '',
      rearResult?.confidence || 0,
      vehicleType
    );

    const reliability = reconciliation.reliability || 'REVIEW';

    const chosenResult = (reconciliation.sourceUsed === 'FRONT' || (reconciliation.sourceUsed === 'MERGED' && frontResult && frontResult.confidence >= (rearResult?.confidence || 0)))
      ? frontResult
      : rearResult;

    const durationMs = Date.now() - startTotal;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OCR] reconciled plate=${reconciliation.bestPlate} sourceUsed=${reconciliation.sourceUsed} durationMs=${durationMs}`);
    }

    return res.status(200).json({
      success: true,
      data: {
        plateNumber: reconciliation.bestPlate,
        normalizedPlate: reconciliation.normalizedPlate,
        bestPlate: reconciliation.bestPlate,
        frontPlateCandidate: frontResult ? (vehicleType === 'CAR' ? frontResult.candidates[0] || frontResult.normalizedPlate || '' : frontResult.normalizedPlate || '') : '',
        rearPlateCandidate: rearResult ? (vehicleType === 'CAR' ? rearResult.candidates[0] || rearResult.normalizedPlate || '' : rearResult.normalizedPlate || '') : '',
        sourceUsed: reconciliation.sourceUsed,
        rawText: (frontResult?.rawText || '') + '\n' + (rearResult?.rawText || ''),
        candidates: chosenResult?.candidates || [reconciliation.bestPlate],
        provider: 'TESSERACT_JS',
        confidence: reconciliation.confidence,
        reliability,
        agreementCount: chosenResult?.agreementCount || 1,
        imageUrl: '',
      },
    });
  }),
};
