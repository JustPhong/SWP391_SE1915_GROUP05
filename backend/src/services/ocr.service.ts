import { createWorker, PSM } from 'tesseract.js';
import fs from 'fs';
import sharp from 'sharp';
import type { Metadata } from 'sharp';
import { AppError } from '../utils/helpers';

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

class OcrExtractionError extends AppError {
  constructor(statusCode: number, message: string, public rawText: string) {
    super(statusCode, message);
  }
}

interface OcrRunBudget {
  used: number;
  max: number;
  startedAt: number;
  deadlineMs: number;
  loggedExhaustion?: boolean;
}

function isOcrBudgetExhausted(budget: OcrRunBudget): boolean {
  const elapsedMs = Date.now() - budget.startedAt;
  const safetyMarginMs = 2500; // safety margin for one Tesseract recognize call (approx 2.5s)
  return (
    budget.used >= budget.max ||
    elapsedMs >= (budget.deadlineMs - safetyMarginMs)
  );
}

function consumeOcrRun(budget: OcrRunBudget): boolean {
  if (isOcrBudgetExhausted(budget)) {
    if (process.env.NODE_ENV !== 'production' && !budget.loggedExhaustion) {
      const elapsedMs = Date.now() - budget.startedAt;
      const reason = budget.used >= budget.max ? 'BUDGET_EXHAUSTED' : 'DEADLINE_REACHED';
      console.log(`[OCR] pipelineStopped reason=${reason} used=${budget.used} elapsedMs=${elapsedMs}`);
      budget.loggedExhaustion = true;
    }
    return false;
  }
  budget.used += 1;
  return true;
}

let workerInstance: TesseractWorker | null = null;
let isInitializing = false;
let lastPsm: PSM | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (workerInstance) return workerInstance;

  if (isInitializing) {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (workerInstance) return workerInstance;
  }

  isInitializing = true;
  try {
    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.',
    });
    workerInstance = worker;
    lastPsm = null;
    return workerInstance;
  } catch (error) {
    const err = error as Error;
    console.error('[OCR] Failed to initialize Tesseract worker:', err.message);
    throw new AppError(503, 'Dịch vụ nhận diện biển số tạm thời chưa sẵn sàng. Vui lòng thử lại.');
  } finally {
    isInitializing = false;
  }
}

export async function shutdownOcrWorker(): Promise<void> {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
    } catch (error) {
      const err = error as Error;
      console.error('[OCR] Error terminating worker:', err.message);
    } finally {
      workerInstance = null;
      lastPsm = null;
    }
  }
}

export async function warmUpOcrWorker(): Promise<void> {
  console.log('[OCR] Warming up Tesseract worker...');
  getWorker()
    .then(() => {
      console.log('[OCR] Tesseract worker warmed up successfully.');
    })
    .catch((err) => {
      console.error('[OCR] Tesseract worker warm-up failed:', err.message);
    });
}

export type OcrReliability = 'VERIFIED' | 'REVIEW';

export interface PlateRecognitionResult {
  rawText: string;
  normalizedPlate: string | null;
  candidates: string[];
  provider: 'TESSERACT_JS';
  confidence: number;
  reliability?: OcrReliability;
  agreementCount?: number;
}

function generateConfusionVariants(text: string): string[] {
  const normalized = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (normalized.length < 7 || normalized.length > 9) {
    return [normalized];
  }

  const digitConfusions: { [key: string]: string } = { 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'O': '0', 'G': '6' };
  const letterConfusions: { [key: string]: string } = { '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '0': 'O', '6': 'G' };

  const variants = new Set<string>();
  variants.add(normalized);

  const swapChar = (str: string, index: number, from: string, to: string) => {
    if (str[index] === from) {
      return str.slice(0, index) + to + str.slice(index + 1);
    }
    return str;
  };

  let list = [normalized];

  // 1. First 2 characters must be digits
  for (let i = 0; i < 2; i++) {
    const next: string[] = [];
    for (const item of list) {
      next.push(item);
      const char = item[i];
      if (digitConfusions[char]) {
        next.push(swapChar(item, i, char, digitConfusions[char]));
      }
    }
    list = next;
  }

  // 2. 3rd character must be a letter
  const next3: string[] = [];
  for (const item of list) {
    next3.push(item);
    const char = item[2];
    if (letterConfusions[char]) {
      next3.push(swapChar(item, 2, char, letterConfusions[char]));
    }
  }
  list = next3;

  // 3. 4th character could be a letter (30AA-1234) or a digit (30A-12345)
  const next4: string[] = [];
  for (const item of list) {
    next4.push(item);
    const char = item[3];
    if (letterConfusions[char]) {
      next4.push(swapChar(item, 3, char, letterConfusions[char]));
    }
    if (digitConfusions[char]) {
      next4.push(swapChar(item, 3, char, digitConfusions[char]));
    }
  }
  list = next4;

  // 4. Remaining characters must be digits
  for (let i = 4; i < normalized.length; i++) {
    const nextR: string[] = [];
    for (const item of list) {
      nextR.push(item);
      const char = item[i];
      if (digitConfusions[char]) {
        nextR.push(swapChar(item, i, char, digitConfusions[char]));
      }
    }
    list = nextR;
  }

  for (const val of list) {
    variants.add(val);
  }

  return Array.from(variants).slice(0, 15);
}

interface NormalizedImageResult {
  orientedBuffer: Buffer;
  orientedWidth: number;
  orientedHeight: number;
  originalWidth: number;
  originalHeight: number;
  originalOrientation?: number;
}

interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

async function normalizeImageForOcr(originalBuffer: Buffer): Promise<NormalizedImageResult> {
  const meta = await sharp(originalBuffer).metadata();
  const originalWidth = meta.width || 0;
  const originalHeight = meta.height || 0;
  const originalOrientation = meta.orientation;

  const orientedBuffer = await sharp(originalBuffer)
    .rotate()
    .toBuffer();

  const orientedMetadata = await sharp(orientedBuffer).metadata();
  const orientedWidth = orientedMetadata.width || 0;
  const orientedHeight = orientedMetadata.height || 0;

  if (!orientedWidth || !orientedHeight) {
    throw new AppError(400, 'Không thể đọc kích thước của ảnh sau khi tự động xoay.');
  }

  return {
    orientedBuffer,
    orientedWidth,
    orientedHeight,
    originalWidth,
    originalHeight,
    originalOrientation,
  };
}

function clampCropRegion(
  crop: CropRegion | undefined,
  orientedWidth: number,
  orientedHeight: number,
  cropName: string,
  prefix: 'CAR' | 'MOTORBIKE' = 'CAR'
): CropRegion | undefined {
  if (!crop) return undefined;

  const left = Math.max(0, Math.min(crop.left, orientedWidth));
  const top = Math.max(0, Math.min(crop.top, orientedHeight));
  const width = Math.max(0, Math.min(crop.width, orientedWidth - left));
  const height = Math.max(0, Math.min(crop.height, orientedHeight - top));

  const isValid = left >= 0 && top >= 0 && width >= 3 && height >= 3 && (left + width <= orientedWidth) && (top + height <= orientedHeight);

  if (process.env.NODE_ENV !== 'production') {
    const right = left + width;
    const bottom = top + height;
    console.log(`[OCR][${prefix}] crop=${cropName}`);
    console.log(`[OCR][${prefix}] left=${left}`);
    console.log(`[OCR][${prefix}] top=${top}`);
    console.log(`[OCR][${prefix}] width=${width}`);
    console.log(`[OCR][${prefix}] height=${height}`);
    console.log(`[OCR][${prefix}] right=${right}`);
    console.log(`[OCR][${prefix}] bottom=${bottom}`);
    console.log(`[OCR][${prefix}] boundsValid=${isValid}`);
  }

  if (!isValid) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OCR][${prefix}] skipped crop=${cropName} reason="Clamped dimensions are smaller than 3x3 or exceed oriented image bounds"`);
    }
    return undefined;
  }

  return { left, top, width, height };
}

function isValidMotorbikePlate(p: string): boolean {
  if (!/^\d{2}[A-Z]{1,2}[A-Z0-9]{4,6}$/.test(p)) return false;
  if (/^\d{2}[A-Z]\d{6}$/.test(p)) return true;
  if (/^\d{2}[A-Z]\d{5}$/.test(p)) return true;
  return /^\d{2}[A-Z]{1,2}[A-Z0-9]{4,6}$/.test(p);
}

function formatMotorbikePlate(p: string): string {
  if (/^\d{2}[A-Z]\d{6}$/.test(p)) {
    const province = p.slice(0, 2);
    const letter = p.slice(2, 3);
    const series = p.slice(3, 4);
    const firstThree = p.slice(4, 7);
    const lastTwo = p.slice(7, 9);
    return `${province}-${letter}${series} ${firstThree}.${lastTwo}`;
  }
  if (/^\d{2}[A-Z]\d{5}$/.test(p)) {
    const province = p.slice(0, 2);
    const letter = p.slice(2, 3);
    const series = p.slice(3, 4);
    const bottom = p.slice(4, 8);
    return `${province}-${letter}${series} ${bottom}`;
  }
  const province = p.slice(0, 2);
  const letterMatch = p.match(/^[0-9]{2}([A-Z]+)/);
  const letter = letterMatch ? letterMatch[1] : '';
  const remaining = p.slice(2 + letter.length);
  return `${province}${letter}-${remaining}`;
}

function isValidCarPlate(p: string): boolean {
  return /^\d{2}[A-Z]\d{5}$/.test(p);
}

function formatCarPlate(p: string): string {
  if (!isValidCarPlate(p)) return p;
  const province = p.slice(0, 2);
  const series = p.slice(2, 3);
  const remaining = p.slice(3);
  const firstThree = remaining.slice(0, 3);
  const lastTwo = remaining.slice(3);
  return `${province}${series}-${firstThree}.${lastTwo}`;
}

function correctUpperLineConfusions(text: string): string {
  const clean = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length !== 3) return clean;

  const digitConfusions: { [key: string]: string } = { 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'O': '0', 'G': '6' };
  let char0 = clean[0];
  let char1 = clean[1];
  if (digitConfusions[char0]) char0 = digitConfusions[char0];
  if (digitConfusions[char1]) char1 = digitConfusions[char1];

  const letterConfusions: { [key: string]: string } = { '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '0': 'O', '6': 'G' };
  let char2 = clean[2];
  if (letterConfusions[char2]) char2 = letterConfusions[char2];

  return char0 + char1 + char2;
}

function correctLowerLineConfusions(text: string): string {
  const clean = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length !== 5) return clean;

  const digitConfusions: { [key: string]: string } = { 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'O': '0', 'G': '6' };
  let result = '';
  for (let i = 0; i < 5; i++) {
    let char = clean[i];
    if (digitConfusions[char]) char = digitConfusions[char];
    result += char;
  }
  return result;
}

function getLowerLineCandidates(text: string): string[] {
  const clean = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const candidates: string[] = [];
  if (clean.length === 5) {
    candidates.push(correctLowerLineConfusions(clean));
  } else if (clean.length > 5) {
    for (let i = 0; i <= clean.length - 5; i++) {
      const windowStr = clean.slice(i, i + 5);
      candidates.push(correctLowerLineConfusions(windowStr));
    }
  }
  return Array.from(new Set(candidates)).filter(c => /^\d{5}$/.test(c));
}

interface ExtractedCandidate {
  normalized: string;
  valid: boolean;
  reason: string;
  sanitized: string;
}

function extractCarCandidates(rawText: string): ExtractedCandidate[] {
  const upperText = rawText.toUpperCase();
  const tokens = upperText.split(/[\s\n\r]+/).map(t => t.replace(/[^A-Z0-9]/g, '')).filter(t => t.length >= 7);

  const results: ExtractedCandidate[] = [];
  const processed = new Set<string>();

  for (const token of tokens) {
    for (let len = 7; len <= 9; len++) {
      for (let i = 0; i <= token.length - len; i++) {
        const windowStr = token.slice(i, i + len);
        const variants = generateConfusionVariants(windowStr);
        for (const normalized of variants) {
          if (processed.has(normalized)) continue;
          processed.add(normalized);

          const isValid = isValidCarPlate(normalized);
          const reason = isValid ? '' : 'Failed structural validation regex';
          results.push({
            normalized,
            valid: isValid,
            reason,
            sanitized: token,
          });
        }
      }
    }
  }

  return results;
}

function extractTwoLineCarCandidates(rawText: string): ExtractedCandidate[] {
  const lines = rawText.split(/[\r\n]+/)
    .map(line => line.replace(/[^A-Z0-9]/gi, '').toUpperCase())
    .filter(line => line.length > 0);

  if (lines.length < 2) return [];

  const results: ExtractedCandidate[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < lines.length - 1; i++) {
    const combined = lines[i] + lines[i+1];
    if (combined.length < 7 || combined.length > 9) continue;
    
    const variants = generateConfusionVariants(combined);
    for (const normalized of variants) {
      if (processed.has(normalized)) continue;
      processed.add(normalized);

      const isValid = isValidCarPlate(normalized);
      results.push({
        normalized,
        valid: isValid,
        reason: isValid ? '' : 'Failed structural validation regex',
        sanitized: combined,
      });
    }
  }

  return results;
}

async function getRotatedBuffer(buf: Buffer, angle: number): Promise<{ buffer: Buffer; w: number; h: number }> {
  const rotated = await sharp(buf).rotate(angle).toBuffer();
  const meta = await sharp(rotated).metadata();
  return {
    buffer: rotated,
    w: meta.width || 0,
    h: meta.height || 0,
  };
}

async function preprocessImageToBuffer(
  imageBuffer: Buffer,
  options: {
    crop?: { left: number; top: number; width: number; height: number };
    resizeWidth?: number;
    processing?: string;
    metadata?: Metadata;
  }
): Promise<Buffer> {
  let pipeline = sharp(imageBuffer);

  if (options.crop) {
    const meta = options.metadata || await pipeline.metadata();
    const imgWidth = meta.width || 0;
    const imgHeight = meta.height || 0;
    if (imgWidth > 0 && imgHeight > 0) {
      const { left, top, width, height } = options.crop;
      const safeLeft = Math.max(0, Math.min(left, imgWidth - 1));
      const safeTop = Math.max(0, Math.min(top, imgHeight - 1));
      const safeWidth = Math.max(1, Math.min(width, imgWidth - safeLeft));
      const safeHeight = Math.max(1, Math.min(height, imgHeight - safeTop));

      pipeline = pipeline.extract({
        left: safeLeft,
        top: safeTop,
        width: safeWidth,
        height: safeHeight,
      });
    }
  }



  if (options.resizeWidth) {
    pipeline = pipeline.resize(options.resizeWidth);
  }

  if (options.processing === 'grayscale-normalize-threshold') {
    pipeline = pipeline.grayscale().normalize().threshold(128);
  } else if (options.processing === 'grayscale-threshold-100') {
    pipeline = pipeline.grayscale().normalize().threshold(100);
  } else if (options.processing === 'grayscale-threshold-145') {
    pipeline = pipeline.grayscale().normalize().threshold(145);
  } else if (options.processing === 'grayscale-threshold-160') {
    pipeline = pipeline.grayscale().normalize().threshold(160);
  } else if (options.processing === 'grayscale-contrast-sharpen') {
    pipeline = pipeline.grayscale().linear(1.4, -30).sharpen();
  } else if (options.processing === 'grayscale-normalize-only') {
    pipeline = pipeline.grayscale().normalize();
  } else if (options.processing === 'grayscale-linear-sharpen') {
    pipeline = pipeline.grayscale().linear(1.5, -40).sharpen();
  } else {
    pipeline = pipeline.grayscale().normalize().sharpen();
  }

  return await pipeline.toBuffer();
}

async function recognizeProcessedPlate(buffer: Buffer, worker: TesseractWorker): Promise<PlateRecognitionResult> {
  const { data } = await worker.recognize(buffer);
  const rawText = data.text || '';
  if (!rawText.trim()) {
    throw new OcrExtractionError(422, 'Không nhận diện được biển số. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.', rawText);
  }

  const plateRegex = /\b\d{2}[A-Z]{1,2}(?:[-. \s\n]?[A-Z0-9]){4,7}\b/gi;
  const matches: string[] = rawText.match(plateRegex) || [];

  const safeRawText: string = typeof rawText === 'string' ? rawText : '';

  const lines: string[] = safeRawText
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);

  for (let i = 0; i < lines.length - 1; i++) {
    const combined = `${lines[i]}${lines[i+1]}`;
    const cleanCombined = combined.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (/^\d{2}[A-Z][A-Z0-9]{4,6}$/.test(cleanCombined)) {
      matches.push(combined);
    }
  }

  const candidatesMap = new Map<string, string>();

  for (const rawMatch of matches) {
    const potentialPlates = generateConfusionVariants(rawMatch);
    for (const normalized of potentialPlates) {
      if (/^\d{2}[A-Z][A-Z0-9]{4,6}$/.test(normalized)) {
        const province = normalized.slice(0, 2);
        const letterMatch = normalized.match(/^[0-9]{2}([A-Z]+)/);
        const letter = letterMatch ? letterMatch[1] : '';
        const remaining = normalized.slice(2 + letter.length);

        let formatted = `${province}${letter}-${remaining}`;
        if (remaining.length === 5) {
          const firstThree = remaining.slice(0, 3);
          const lastTwo = remaining.slice(3);
          formatted = `${province}${letter}-${firstThree}.${lastTwo}`;
        }
        candidatesMap.set(normalized, formatted);
      }
    }
  }

  if (candidatesMap.size === 0) {
    throw new OcrExtractionError(422, 'Không nhận diện được biển số. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.', rawText);
  }

  const uniqueNormalized = Array.from(candidatesMap.keys());
  const uniqueFormatted = Array.from(candidatesMap.values());

  return {
    rawText,
    normalizedPlate: uniqueNormalized[0],
    candidates: uniqueFormatted,
    provider: 'TESSERACT_JS',
    confidence: data.confidence,
  };
}

async function performOcr(imageBuffer: Buffer, vehicleType: 'CAR' | 'MOTORBIKE' = 'CAR'): Promise<PlateRecognitionResult> {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new AppError(400, 'Không tìm thấy dữ liệu ảnh để nhận diện.');
  }

  const worker = await getWorker();
  const startTime = Date.now();

  const runBudget: OcrRunBudget = {
    used: 0,
    max: 25,
    startedAt: Date.now(),
    deadlineMs: 45_000,
  };

  try {
    const normResult = await normalizeImageForOcr(imageBuffer);
    const { orientedBuffer, orientedWidth: w, orientedHeight: h } = normResult;

    if (process.env.NODE_ENV !== 'production') {
      const prefix = vehicleType === 'CAR' ? 'CAR' : 'MOTORBIKE';
      console.log(`[OCR][${prefix}] originalImage=${normResult.originalWidth}x${normResult.originalHeight} orientation=${normResult.originalOrientation || 'unknown'}`);
    console.log(`[OCR][${prefix}] orientedImage=${w}x${h}`);
    }

    const setPsm = async (psm: PSM) => {
      if (lastPsm !== psm) {
        await worker.setParameters({
          tessedit_pageseg_mode: psm,
        });
        lastPsm = psm;
      }
    };

    if (vehicleType === 'MOTORBIKE') {
      const rawMotorbikeCrop = w > 0 && h > 0 ? {
        left: Math.floor(w * 0.32),
        top: Math.floor(h * 0.55),
        width: Math.floor(w * 0.36),
        height: Math.floor(h * 0.35),
      } : undefined;

      const motorbikeCrop = clampCropRegion(rawMotorbikeCrop, w, h, 'MOTORBIKE_REAR_PLATE', 'MOTORBIKE');
      if (!motorbikeCrop) {
        throw new AppError(422, 'Không thể định vị được vùng chứa biển số xe máy.');
      }

      const motorbikeVariants = [
        { name: 'mb-normalize-sharpen', processing: 'grayscale-normalize-sharpen' },
        { name: 'mb-normalize-threshold', processing: 'grayscale-normalize-threshold' },
        { name: 'mb-linear-sharpen', processing: 'grayscale-linear-sharpen' }
      ];

      interface MotorbikeCandidate {
        normalizedPlate: string;
        formattedPlate: string;
        rawText: string;
        confidence: number;
        variantName: string;
        strategy: 'WHOLE_BLOCK' | 'SPLIT_LINE';
        topLineValid: boolean;
        bottomLineValid: boolean;
        agreementCount?: number;
      }

      const motorbikeCandidates: MotorbikeCandidate[] = [];
      let lastError: Error | null = null;

      for (const variant of motorbikeVariants) {
        // --- STRATEGY A: WHOLE TWO-LINE BLOCK ---
        try {
          const blockBuffer = await preprocessImageToBuffer(orientedBuffer, {
            crop: motorbikeCrop,
            resizeWidth: 1200,
            processing: variant.processing,
          });

          const procMeta = await sharp(blockBuffer).metadata();
          const procW = procMeta.width || 0;
          const procH = procMeta.height || 0;
          const procValid = Number.isFinite(procW) && Number.isFinite(procH) && procW >= 3 && procH >= 3;
          if (!procValid) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][MOTORBIKE] skipped variant=${variant.name} reason="invalid processed dimensions" width=${procW} height=${procH}`);
            }
            continue;
          }

          await setPsm(PSM.SINGLE_BLOCK);
          const { data } = await worker.recognize(blockBuffer);
          const rawText = data.text || '';
          
          const lines = rawText.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);
          
          if (lines.length >= 2) {
            for (let i = 0; i < lines.length - 1; i++) {
              const topClean = lines[i].replace(/[^A-Z0-9]/gi, '').toUpperCase();
              const bottomClean = lines[i+1].replace(/[^A-Z0-9]/gi, '').toUpperCase();
              const combinedRaw = topClean + bottomClean;
              
              const potentialPlates = generateConfusionVariants(combinedRaw);
              for (const combined of potentialPlates) {
                if (isValidMotorbikePlate(combined)) {
                  const topLen = combined.length === 9 ? 4 : 3;
                  const topPart = combined.slice(0, topLen);
                  const bottomPart = combined.slice(topLen);
                  
                  const topValid = /^\d{2}[A-Z]{1,2}\d?$/.test(topPart);
                  const bottomValid = /^\d{4,5}$/.test(bottomPart);
                  
                  motorbikeCandidates.push({
                    normalizedPlate: combined,
                    formattedPlate: formatMotorbikePlate(combined),
                    rawText: rawText,
                    confidence: data.confidence,
                    variantName: variant.name,
                    strategy: 'WHOLE_BLOCK',
                    topLineValid: topValid,
                    bottomLineValid: bottomValid,
                  });
                }
              }
            }
          }
          
          const cleanedText = rawText.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const potentialPlates = generateConfusionVariants(cleanedText);
          for (const combined of potentialPlates) {
            if (isValidMotorbikePlate(combined)) {
              motorbikeCandidates.push({
                normalizedPlate: combined,
                formattedPlate: formatMotorbikePlate(combined),
                rawText: rawText,
                confidence: data.confidence,
                variantName: variant.name,
                strategy: 'WHOLE_BLOCK',
                topLineValid: false,
                bottomLineValid: false,
              });
            }
          }
        } catch (err) {
          lastError = err as Error;
        }

        // --- STRATEGY B: SPLIT-LINE OCR ---
        try {
          const topCrop = {
            left: motorbikeCrop.left,
            top: motorbikeCrop.top,
            width: motorbikeCrop.width,
            height: Math.floor(motorbikeCrop.height * 0.52),
          };
          const bottomCrop = {
            left: motorbikeCrop.left,
            top: motorbikeCrop.top + Math.floor(motorbikeCrop.height * 0.48),
            width: motorbikeCrop.width,
            height: Math.ceil(motorbikeCrop.height * 0.52),
          };

          const topBuffer = await preprocessImageToBuffer(orientedBuffer, {
            crop: topCrop,
            resizeWidth: 1200,
            processing: variant.processing,
          });
          const topMeta = await sharp(topBuffer).metadata();
          const topW = topMeta.width || 0;
          const topH = topMeta.height || 0;
          const topValid = Number.isFinite(topW) && Number.isFinite(topH) && topW >= 3 && topH >= 3;

          const bottomBuffer = await preprocessImageToBuffer(orientedBuffer, {
            crop: bottomCrop,
            resizeWidth: 1200,
            processing: variant.processing,
          });
          const bottomMeta = await sharp(bottomBuffer).metadata();
          const bottomW = bottomMeta.width || 0;
          const bottomH = bottomMeta.height || 0;
          const bottomValid = Number.isFinite(bottomW) && Number.isFinite(bottomH) && bottomW >= 3 && bottomH >= 3;

          if (!topValid || !bottomValid) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][MOTORBIKE] skipped variant=${variant.name} reason="invalid processed dimensions"`);
            }
            continue;
          }

          await setPsm(PSM.SINGLE_LINE);
          const topRes = await worker.recognize(topBuffer);
          const topTextRaw = topRes.data.text || '';
          const topClean = topTextRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();

          await setPsm(PSM.SINGLE_LINE);
          const bottomRes = await worker.recognize(bottomBuffer);
          const bottomTextRaw = bottomRes.data.text || '';
          const bottomClean = bottomTextRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();

          const combinedRaw = topClean + bottomClean;
          const potentialPlates = generateConfusionVariants(combinedRaw);
          for (const combined of potentialPlates) {
            if (isValidMotorbikePlate(combined)) {
              const topLen = combined.length === 9 ? 4 : 3;
              const topPart = combined.slice(0, topLen);
              const bottomPart = combined.slice(topLen);
              
              const topValid = /^\d{2}[A-Z]{1,2}\d?$/.test(topPart);
              const bottomValid = /^\d{4,5}$/.test(bottomPart);

              motorbikeCandidates.push({
                normalizedPlate: combined,
                formattedPlate: formatMotorbikePlate(combined),
                rawText: `Top: ${topTextRaw.trim()} | Bottom: ${bottomTextRaw.trim()}`,
                confidence: Math.round((topRes.data.confidence + bottomRes.data.confidence) / 2),
                variantName: variant.name,
                strategy: 'SPLIT_LINE',
                topLineValid: topValid,
                bottomLineValid: bottomValid,
              });
            }
          }
        } catch (err) {
          lastError = err as Error;
        }
      }

      if (motorbikeCandidates.length === 0) {
        throw lastError || new AppError(422, 'Không nhận diện được biển số. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.');
      }

      const agreementMap = new Map<string, number>();
      for (const cand of motorbikeCandidates) {
        agreementMap.set(cand.normalizedPlate, (agreementMap.get(cand.normalizedPlate) || 0) + 1);
      }
      for (const cand of motorbikeCandidates) {
        cand.agreementCount = agreementMap.get(cand.normalizedPlate) || 1;
      }

      const sortedCandidates = [...motorbikeCandidates].sort((a, b) => {
        const aModern = a.normalizedPlate.length === 9 && a.topLineValid && a.bottomLineValid;
        const bModern = b.normalizedPlate.length === 9 && b.topLineValid && b.bottomLineValid;
        if (aModern && !bModern) return -1;
        if (!aModern && bModern) return 1;

        const aAg = a.agreementCount || 0;
        const bAg = b.agreementCount || 0;
        if (aAg !== bAg) return bAg - aAg;

        const aBoth = a.topLineValid && a.bottomLineValid;
        const bBoth = b.topLineValid && b.bottomLineValid;
        if (aBoth && !bBoth) return -1;
        if (!aBoth && bBoth) return 1;

        if (a.normalizedPlate.length !== b.normalizedPlate.length) {
          return b.normalizedPlate.length - a.normalizedPlate.length;
        }

        return b.confidence - a.confidence;
      });

      const selected = sortedCandidates[0];

      if (process.env.NODE_ENV !== 'production') {
        console.log('\n[MOTORBIKE OCR Diagnostics Table]');
        console.log('-----------------------------------------------------------------------------------------------------');
        console.log('| Variant Name             | Strategy   | Normalized | Conf | TopVal | BotVal | Status   | Selected |');
        console.log('-----------------------------------------------------------------------------------------------------');
        for (const cand of sortedCandidates) {
          const isSelected = cand === selected ? 'SELECTED' : 'REJECTED';
          const nameCol = cand.variantName.padEnd(24);
          const stratCol = cand.strategy.padEnd(10);
          const normCol = cand.normalizedPlate.padEnd(10);
          const confCol = Math.round(cand.confidence).toString().padStart(4);
          const topVal = cand.topLineValid ? 'YES' : 'NO ';
          const botVal = cand.bottomLineValid ? 'YES' : 'NO ';
          const statusStr = (cand.topLineValid && cand.bottomLineValid ? 'VALID' : 'PARTIAL').padEnd(8);
          console.log(`| ${nameCol} | ${stratCol} | ${normCol} | ${confCol} | ${topVal}    | ${botVal}    | ${statusStr} | ${isSelected.padEnd(8)} |`);
        }
        console.log('-----------------------------------------------------------------------------------------------------\n');
      }

      let reliability: OcrReliability = 'REVIEW';
      const isSplitLineValid = selected.strategy === 'SPLIT_LINE' && selected.topLineValid && selected.bottomLineValid;
      const hasAgreeingVariant = selected.agreementCount && selected.agreementCount >= 2;
      const isStrongModern = selected.normalizedPlate.length === 9 && selected.topLineValid && selected.bottomLineValid && hasAgreeingVariant;

      if ((isSplitLineValid && hasAgreeingVariant) || isStrongModern || (selected.agreementCount && selected.agreementCount >= 3)) {
        reliability = 'VERIFIED';
      }

      return {
        rawText: selected.rawText,
        normalizedPlate: selected.normalizedPlate,
        candidates: [selected.formattedPlate],
        provider: 'TESSERACT_JS',
        confidence: selected.confidence,
        reliability,
        agreementCount: selected.agreementCount || 1,
      };
    }

    // CAR SPECIFIC PIPELINE
    interface CarCandidate {
      normalizedPlate: string;
      formattedPlate: string;
      rawText: string;
      confidence: number;
      cropName: string;
      variantName: string;
      valid: boolean;
      rejectionReason: string;
      agreementCount?: number;
      orientationName: 'ORIGINAL' | 'ROTATE_90_CW' | 'ROTATE_90_CCW' | 'ROTATE_180';
      orientationWidth: number;
      orientationHeight: number;
      strategy?: 'CAR_ONE_LINE' | 'CAR_TWO_LINE_BLOCK' | 'CAR_TWO_LINE_SPLIT';
      isUnconfirmedWindow?: boolean;
    }

    const carCandidates: CarCandidate[] = [];
    let lastError: Error | null = null;
    let selectedCandidate: CarCandidate | null = null;

    const evaluateOrientation = async (
      buf: Buffer,
      width: number,
      height: number,
      orientationName: 'ORIGINAL' | 'ROTATE_90_CW' | 'ROTATE_90_CCW' | 'ROTATE_180',
      budget: OcrRunBudget
    ): Promise<boolean> => {
      const ratio = height / width;
      let profile: 'PORTRAIT' | 'LANDSCAPE' | 'NEAR_SQUARE' = 'NEAR_SQUARE';
      if (ratio >= 1.15) {
        profile = 'PORTRAIT';
      } else if (width / height >= 1.15) {
        profile = 'LANDSCAPE';
      }

      const getClampedCrop = (
        leftPct: number,
        topPct: number,
        widthPct: number,
        heightPct: number,
        name: string
      ) => {
        const raw = {
          left: Math.max(0, Math.min(Math.floor(width * leftPct), width - 1)),
          top: Math.max(0, Math.min(Math.floor(height * topPct), height - 1)),
          width: Math.max(10, Math.min(Math.floor(width * widthPct), width)),
          height: Math.max(10, Math.min(Math.floor(height * heightPct), height)),
        };
        return clampCropRegion(raw, width, height, name, 'CAR');
      };

      interface CarVariant {
        name: string;
        cropName: string;
        crop: { left: number; top: number; width: number; height: number } | undefined;
        psm: PSM;
      }

      const carVariants: CarVariant[] = [];

      if (profile === 'PORTRAIT') {
        carVariants.push(
          { name: 'PORTRAIT_CENTER_TIGHT', cropName: 'PORTRAIT_CENTER_TIGHT', crop: getClampedCrop(0.25, 0.40, 0.50, 0.27, 'PORTRAIT_CENTER_TIGHT'), psm: PSM.SINGLE_LINE },
          { name: 'PORTRAIT_CENTER_MEDIUM', cropName: 'PORTRAIT_CENTER_MEDIUM', crop: getClampedCrop(0.17, 0.35, 0.66, 0.38, 'PORTRAIT_CENTER_MEDIUM'), psm: PSM.SINGLE_LINE },
          { name: 'PORTRAIT_CENTER_WIDE', cropName: 'PORTRAIT_CENTER_WIDE', crop: getClampedCrop(0.08, 0.28, 0.84, 0.50, 'PORTRAIT_CENTER_WIDE'), psm: PSM.SINGLE_LINE },
          { name: 'PORTRAIT_LOWER_RECOVERY', cropName: 'PORTRAIT_LOWER_RECOVERY', crop: getClampedCrop(0.12, 0.48, 0.76, 0.38, 'PORTRAIT_LOWER_RECOVERY'), psm: PSM.SINGLE_LINE }
        );
      } else if (profile === 'LANDSCAPE') {
        carVariants.push(
          { name: 'LANDSCAPE_CENTER_TIGHT', cropName: 'LANDSCAPE_CENTER_TIGHT', crop: getClampedCrop(0.28, 0.55, 0.44, 0.25, 'LANDSCAPE_CENTER_TIGHT'), psm: PSM.SINGLE_LINE },
          { name: 'LANDSCAPE_CENTER_MEDIUM', cropName: 'LANDSCAPE_CENTER_MEDIUM', crop: getClampedCrop(0.18, 0.48, 0.64, 0.36, 'LANDSCAPE_CENTER_MEDIUM'), psm: PSM.SINGLE_LINE },
          { name: 'LANDSCAPE_CENTER_WIDE', cropName: 'LANDSCAPE_CENTER_WIDE', crop: getClampedCrop(0.08, 0.38, 0.84, 0.52, 'LANDSCAPE_CENTER_WIDE'), psm: PSM.SINGLE_LINE }
        );
      } else {
        carVariants.push(
          { name: 'SQUARE_CENTER', cropName: 'SQUARE_CENTER', crop: getClampedCrop(0.18, 0.40, 0.64, 0.40, 'SQUARE_CENTER'), psm: PSM.SINGLE_LINE },
          { name: 'SQUARE_WIDE', cropName: 'SQUARE_WIDE', crop: getClampedCrop(0.08, 0.30, 0.84, 0.55, 'SQUARE_WIDE'), psm: PSM.SINGLE_LINE }
        );
      }

      let orientationFound = false;

      const getBestCandidateForOrientation = (orient: string): CarCandidate | null => {
        const validForThis = carCandidates.filter(c => c.valid && c.orientationName === orient);
        if (validForThis.length === 0) return null;

        const agreementMap = new Map<string, number>();
        for (const cand of validForThis) {
          agreementMap.set(cand.normalizedPlate, (agreementMap.get(cand.normalizedPlate) || 0) + 1);
        }
        for (const cand of validForThis) {
          cand.agreementCount = agreementMap.get(cand.normalizedPlate) || 1;
        }

        return [...validForThis].sort((a, b) => {
          const aLen = a.normalizedPlate.length;
          const bLen = b.normalizedPlate.length;
          if (aLen !== bLen) return bLen - aLen;

          const aAg = a.agreementCount || 0;
          const bAg = b.agreementCount || 0;
          if (aAg !== bAg) return bAg - aAg;

          return b.confidence - a.confidence;
        })[0];
      };

      const runPassForCrop = async (
        cropRegion: { left: number; top: number; width: number; height: number },
        processing: string,
        cropName: string,
        budget: OcrRunBudget,
        stageName: string = 'STAGE_B'
      ): Promise<{ validCandidatesCount: number } | null> => {
        if (!consumeOcrRun(budget)) {
          return null;
        }

        const runStart = Date.now();
        const buffer = await preprocessImageToBuffer(buf, {
          crop: cropRegion,
          resizeWidth: 1800,
          processing,
        });

        const procMeta = await sharp(buffer).metadata();
        const procW = procMeta.width || 0;
        const procH = procMeta.height || 0;
        if (procW < 3 || procH < 3) return null;

        await setPsm(PSM.SINGLE_LINE);
        const { data } = await worker.recognize(buffer);
        const rawText = data.text || '';
        const elapsed = Date.now() - runStart;

        const extracted = extractCarCandidates(rawText);
        const bestExt = extracted.find(e => e.valid) || extracted[0];
        const normalized = bestExt ? bestExt.normalized : '';
        const isValid = bestExt ? bestExt.valid : false;

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[OCR][RUN] stage=${stageName} region=${cropName} variant=${processing} rotation=0 used=${budget.used}/${budget.max} elapsedMs=${elapsed} raw="${rawText.replace(/[\r\n]+/g, '\\n')}" normalized="${normalized}" valid=${isValid}`);
        }

        let validCount = 0;

        for (const ext of extracted) {
          const isValidCand = ext.valid;
          const normalizedCand = ext.normalized;
          const reason = ext.reason;

          if (isValidCand) {
            validCount++;
          }

          carCandidates.push({
            normalizedPlate: normalizedCand,
            formattedPlate: formatCarPlate(normalizedCand),
            rawText: rawText,
            confidence: data.confidence,
            cropName,
            variantName: `${cropName.toLowerCase()}-${processing.split('-').slice(1).join('-')}`,
            valid: isValidCand,
            rejectionReason: reason,
            orientationName,
            orientationWidth: width,
            orientationHeight: height,
            strategy: 'CAR_ONE_LINE',
          });
        }

        if (extracted.length === 0) {
          carCandidates.push({
            normalizedPlate: '',
            formattedPlate: '',
            rawText: rawText,
            confidence: data.confidence,
            cropName,
            variantName: `${cropName.toLowerCase()}-${processing.split('-').slice(1).join('-')}`,
            valid: false,
            rejectionReason: 'No valid plate length found in raw text',
            orientationName,
            orientationWidth: width,
            orientationHeight: height,
            strategy: 'CAR_ONE_LINE',
          });
        }

        return { validCandidatesCount: validCount };
      };

      const runPassForRotatedCrop = async (
        rotatedBuffer: Buffer,
        cropName: string,
        angle: number,
        processing: string,
        budget: OcrRunBudget,
        stageName: string = 'SMALL_ROTATION'
      ): Promise<void> => {
        if (!consumeOcrRun(budget)) {
          return;
        }

        const runStart = Date.now();
        const buffer = await preprocessImageToBuffer(rotatedBuffer, {
          resizeWidth: 1800,
          processing,
        });

        const procMeta = await sharp(buffer).metadata();
        const procW = procMeta.width || 0;
        const procH = procMeta.height || 0;
        if (procW < 3 || procH < 3) return;

        await setPsm(PSM.SINGLE_LINE);
        const { data } = await worker.recognize(buffer);
        const rawText = data.text || '';
        const elapsed = Date.now() - runStart;

        const extracted = extractCarCandidates(rawText);
        const bestExt = extracted.find(e => e.valid) || extracted[0];
        const normalized = bestExt ? bestExt.normalized : '';
        const isValid = bestExt ? bestExt.valid : false;

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[OCR][RUN] stage=${stageName} region=${cropName} variant=${processing} rotation=${angle} used=${budget.used}/${budget.max} elapsedMs=${elapsed} raw="${rawText.replace(/[\r\n]+/g, '\\n')}" normalized="${normalized}" valid=${isValid}`);
        }

        for (const ext of extracted) {
          carCandidates.push({
            normalizedPlate: ext.normalized,
            formattedPlate: formatCarPlate(ext.normalized),
            rawText: rawText,
            confidence: data.confidence,
            cropName,
            variantName: `${cropName.toLowerCase()}-${processing.split('-').slice(1).join('-')}-rot-${angle}`,
            valid: ext.valid,
            rejectionReason: ext.reason,
            orientationName,
            orientationWidth: width,
            orientationHeight: height,
            strategy: 'CAR_ONE_LINE',
          });
        }

        if (extracted.length === 0) {
          carCandidates.push({
            normalizedPlate: '',
            formattedPlate: '',
            rawText: rawText,
            confidence: data.confidence,
            cropName,
            variantName: `${cropName.toLowerCase()}-${processing.split('-').slice(1).join('-')}-rot-${angle}`,
            valid: false,
            rejectionReason: 'No valid plate length found in raw text',
            orientationName,
            orientationWidth: width,
            orientationHeight: height,
            strategy: 'CAR_ONE_LINE',
          });
        }
      };

      const runRecoveryScan = async (budget: OcrRunBudget): Promise<boolean> => {
        const yStart = profile === 'PORTRAIT' ? 0.35 : 0.42;
        const yEnd = profile === 'PORTRAIT' ? 0.75 : 0.88;
        const yHeight = yEnd - yStart;

        const recoveryCrops = [
          { name: 'LEFT_RECOVERY', left: 0.0, top: yStart, width: 0.55, height: yHeight },
          { name: 'CENTER_RECOVERY', left: 0.22, top: yStart, width: 0.56, height: yHeight },
          { name: 'RIGHT_RECOVERY', left: 0.45, top: yStart, width: 0.55, height: yHeight },
        ];

        let foundInRecovery = false;

        for (const rc of recoveryCrops) {
          const crop = getClampedCrop(rc.left, rc.top, rc.width, rc.height, rc.name);
          if (!crop) continue;

          try {
            if (!consumeOcrRun(budget)) continue;

            const buffer = await preprocessImageToBuffer(buf, {
              crop,
              resizeWidth: 1800,
              processing: 'grayscale-normalize-sharpen',
            });

            const procMeta = await sharp(buffer).metadata();
            const procW = procMeta.width || 0;
            const procH = procMeta.height || 0;
            if (procW < 3 || procH < 3) continue;

            await setPsm(PSM.SINGLE_LINE);
            const { data } = await worker.recognize(buffer);
            const rawText = data.text || '';

            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][CAR] [RECOVERY][${rc.name}] raw="${rawText.replace(/[\r\n]+/g, '\\n')}"`);
            }

            const extracted = extractCarCandidates(rawText);
            
            for (const ext of extracted) {
              carCandidates.push({
                normalizedPlate: ext.normalized,
                formattedPlate: formatCarPlate(ext.normalized),
                rawText: rawText,
                confidence: data.confidence,
                cropName: rc.name,
                variantName: `${rc.name.toLowerCase()}-normalize-sharpen`,
                valid: ext.valid,
                rejectionReason: ext.reason,
                orientationName,
                orientationWidth: width,
                orientationHeight: height,
                strategy: 'CAR_ONE_LINE',
              });
            }

            if (extracted.length === 0) {
              carCandidates.push({
                normalizedPlate: '',
                formattedPlate: '',
                rawText: rawText,
                confidence: data.confidence,
                cropName: rc.name,
                variantName: `${rc.name.toLowerCase()}-normalize-sharpen`,
                valid: false,
                rejectionReason: 'No valid plate length found in raw text',
                orientationName,
                orientationWidth: width,
                orientationHeight: height,
                strategy: 'CAR_ONE_LINE',
              });
            }

            const rawAlpha = rawText.replace(/[^A-Z0-9]/gi, '');
            const hasCandidates = extracted.length > 0;
            const isPlateLike = hasCandidates || rawAlpha.length >= 7;

            if (isPlateLike) {
              let recoveryMatchFound = hasCandidates && extracted.some(ext => ext.valid);
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[OCR][CAR] [RECOVERY][${rc.name}] Plate-like text detected. Expanding scan...`);
              }

              if (!recoveryMatchFound) {
                try {
                  const res = await runPassForCrop(crop, 'grayscale-normalize-threshold', rc.name, budget);
                  if (res && res.validCandidatesCount > 0) recoveryMatchFound = true;
                } catch (e) {}
              }
              if (!recoveryMatchFound) {
                try {
                  await runPassForCrop(crop, 'grayscale-linear-sharpen', rc.name, budget);
                } catch (e) {}
              }
              
              const validCandidates = carCandidates.filter(c => c.valid && c.orientationName === orientationName && c.cropName === rc.name);
              if (validCandidates.length > 0) {
                foundInRecovery = true;
              }
            }
          } catch (e) {
            // Ignore
          }
        }

        return foundInRecovery;
      };

      const runTwoLineFallbackForCrops = async (
        cropsList: { name: string; cropName: string; crop: { left: number; top: number; width: number; height: number } | undefined }[],
        anglesList: number[],
        processingList: string[],
        budget: OcrRunBudget
      ): Promise<void> => {
        const splitRatios = [
          { upperPct: 0.43, lowerStartPct: 0.38, name: '40/60' },
          { upperPct: 0.48, lowerStartPct: 0.43, name: '45/55' },
          { upperPct: 0.53, lowerStartPct: 0.48, name: '50/50' }
        ];
        const insets = [0, 0.08];

        for (const v of cropsList) {
          if (!v.crop) continue;

          for (const angle of anglesList) {
            try {
              const rotatedCropBuffer = await sharp(buf)
                .extract(v.crop)
                .rotate(angle, { background: '#FFFFFF' })
                .toBuffer();

              const rotCropMeta = await sharp(rotatedCropBuffer).metadata();
              const rotCropW = rotCropMeta.width || 0;
              const rotCropH = rotCropMeta.height || 0;
              if (rotCropW < 3 || rotCropH < 3) continue;

              for (const processing of processingList) {
                // --- Strategy A: WHOLE BLOCK ---
                if (consumeOcrRun(budget)) {
                  const blockBuffer = await preprocessImageToBuffer(rotatedCropBuffer, {
                    resizeWidth: 1800,
                    processing,
                  });

                  await setPsm(PSM.SINGLE_BLOCK);
                  let res = await worker.recognize(blockBuffer);
                  let rawText = res.data.text || '';
                  let extracted = extractTwoLineCarCandidates(rawText);

                  if (extracted.length === 0) {
                    if (consumeOcrRun(budget)) {
                      await setPsm(PSM.SPARSE_TEXT);
                      res = await worker.recognize(blockBuffer);
                      rawText = res.data.text || '';
                      extracted = extractTwoLineCarCandidates(rawText);
                    }
                  }

                  for (const ext of extracted) {
                    carCandidates.push({
                      normalizedPlate: ext.normalized,
                      formattedPlate: formatCarPlate(ext.normalized),
                      rawText: rawText,
                      confidence: res.data.confidence,
                      cropName: v.cropName,
                      variantName: `${v.cropName.toLowerCase()}-two-line-block-${processing.split('-').slice(1).join('-')}-rot-${angle}`,
                      valid: ext.valid,
                      rejectionReason: ext.reason + ' (WHOLE_BLOCK)',
                      orientationName,
                      orientationWidth: width,
                      orientationHeight: height,
                      strategy: 'CAR_TWO_LINE_BLOCK'
                    });
                  }
                }

                // --- Strategy B: SPLIT LINES ---
                for (const ratio of splitRatios) {
                  for (const insetPct of insets) {
                    const insetW = Math.floor(rotCropW * insetPct);
                    const left = insetW;
                    const widthVal = rotCropW - 2 * insetW;

                    const upperRegion = {
                      left,
                      top: 0,
                      width: widthVal,
                      height: Math.floor(rotCropH * ratio.upperPct),
                    };
                    const lowerRegion = {
                      left,
                      top: Math.floor(rotCropH * ratio.lowerStartPct),
                      width: widthVal,
                      height: rotCropH - Math.floor(rotCropH * ratio.lowerStartPct),
                    };

                    const upperCrop = clampCropRegion(upperRegion, rotCropW, rotCropH, `${v.cropName}_SPLIT_UPPER_INSET_${Math.round(insetPct * 100)}`, 'CAR');
                    const lowerCrop = clampCropRegion(lowerRegion, rotCropW, rotCropH, `${v.cropName}_SPLIT_LOWER_INSET_${Math.round(insetPct * 100)}`, 'CAR');

                    if (!upperCrop || !lowerCrop) continue;

                    const upperBuf = await preprocessImageToBuffer(rotatedCropBuffer, { crop: upperCrop, resizeWidth: 1800, processing });
                    const lowerBuf = await preprocessImageToBuffer(rotatedCropBuffer, { crop: lowerCrop, resizeWidth: 1800, processing });

                    const uMeta = await sharp(upperBuf).metadata();
                    const lMeta = await sharp(lowerBuf).metadata();
                    if ((uMeta.width || 0) < 3 || (uMeta.height || 0) < 3 || (lMeta.width || 0) < 3 || (lMeta.height || 0) < 3) continue;

                    if (!consumeOcrRun(budget)) continue;
                    await setPsm(PSM.SINGLE_LINE);
                    const uRes = await worker.recognize(upperBuf);
                    const uRaw = uRes.data.text || '';
                    const uSanit = uRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();

                    const uCorrected = correctUpperLineConfusions(uSanit);
                    const isUpperValid = /^\d{2}[A-Z]$/.test(uCorrected);
                    if (!isUpperValid) {
                      carCandidates.push({
                        normalizedPlate: '',
                        formattedPlate: '',
                        rawText: `${uRaw}\n`,
                        confidence: uRes.data.confidence,
                        cropName: v.cropName,
                        variantName: `${v.cropName.toLowerCase()}-two-line-split-${processing.split('-').slice(1).join('-')}-inset-${Math.round(insetPct * 100)}-rot-${angle}-ratio-${ratio.name}`,
                        valid: false,
                        rejectionReason: `Upper line "${uCorrected}" (raw: "${uSanit}") does not match structure (SPLIT_LINES)`,
                        orientationName,
                        orientationWidth: width,
                        orientationHeight: height,
                        strategy: 'CAR_TWO_LINE_SPLIT'
                      });
                      continue;
                    }

                    if (!consumeOcrRun(budget)) continue;
                    await setPsm(PSM.SINGLE_LINE);
                    const lRes = await worker.recognize(lowerBuf);
                    const lRaw = lRes.data.text || '';
                    const lSanit = lRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();

                    const lowerCands = getLowerLineCandidates(lSanit);
                    if (lowerCands.length === 0) {
                      carCandidates.push({
                        normalizedPlate: '',
                        formattedPlate: '',
                        rawText: `${uRaw}\n${lRaw}`,
                        confidence: Math.min(uRes.data.confidence, lRes.data.confidence),
                        cropName: v.cropName,
                        variantName: `${v.cropName.toLowerCase()}-two-line-split-${processing.split('-').slice(1).join('-')}-inset-${Math.round(insetPct * 100)}-rot-${angle}-ratio-${ratio.name}`,
                        valid: false,
                        rejectionReason: `No valid lower line candidates found from raw "${lSanit}" (SPLIT_LINES)`,
                        orientationName,
                        orientationWidth: width,
                        orientationHeight: height,
                        strategy: 'CAR_TWO_LINE_SPLIT'
                      });
                      continue;
                    }

                    for (const lCand of lowerCands) {
                      const combined = uCorrected + lCand;
                      const isValid = isValidCarPlate(combined);

                      if (process.env.NODE_ENV !== 'production') {
                        console.log(`[OCR][CAR][TWO_LINE][SPLIT] upperRaw="${uRaw.trim()}" corrected="${uCorrected}"`);
                        console.log(`[OCR][CAR][TWO_LINE][SPLIT] lowerRaw="${lRaw.trim()}" corrected="${lCand}"`);
                        console.log(`[OCR][CAR][TWO_LINE][SPLIT] combined="${combined}" valid=${isValid}`);
                      }

                      carCandidates.push({
                        normalizedPlate: combined,
                        formattedPlate: formatCarPlate(combined),
                        rawText: `${uRaw}\n${lRaw}`,
                        confidence: Math.min(uRes.data.confidence, lRes.data.confidence),
                        cropName: v.cropName,
                        variantName: `${v.cropName.toLowerCase()}-two-line-split-${processing.split('-').slice(1).join('-')}-inset-${Math.round(insetPct * 100)}-rot-${angle}-ratio-${ratio.name}`,
                        valid: isValid,
                        rejectionReason: isValid ? '' : 'Failed structural validation regex (SPLIT_LINES)',
                        orientationName,
                        orientationWidth: width,
                        orientationHeight: height,
                        strategy: 'CAR_TWO_LINE_SPLIT'
                      });
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore
            }
          }
        }
      };

      const runTargetedTwoLineSplit = async (
        lc: { name: string; crop: { left: number; top: number; width: number; height: number } | undefined },
        ratio: { upperPct: number; lowerStartPct: number; name: string },
        processing: string,
        insetPct: number,
        angle: number = 0
      ) => {
        if (!lc.crop) return;
        if (isOcrBudgetExhausted(budget)) return;

        try {
          const rotatedCropBuffer = await sharp(buf)
            .extract(lc.crop)
            .rotate(angle, { background: '#FFFFFF' })
            .toBuffer();

          const rotCropMeta = await sharp(rotatedCropBuffer).metadata();
          const rotCropW = rotCropMeta.width || 0;
          const rotCropH = rotCropMeta.height || 0;
          if (rotCropW < 3 || rotCropH < 3) return;

          const insetW = Math.floor(rotCropW * insetPct);
          const left = insetW;
          const widthVal = rotCropW - 2 * insetW;

          const upperRegion = {
            left,
            top: 0,
            width: widthVal,
            height: Math.floor(rotCropH * ratio.upperPct),
          };
          const lowerRegion = {
            left,
            top: Math.floor(rotCropH * ratio.lowerStartPct),
            width: widthVal,
            height: rotCropH - Math.floor(rotCropH * ratio.lowerStartPct),
          };

          const upperCrop = clampCropRegion(upperRegion, rotCropW, rotCropH, `${lc.name}_SPLIT_UPPER_INSET_${Math.round(insetPct * 100)}`, 'CAR');
          const lowerCrop = clampCropRegion(lowerRegion, rotCropW, rotCropH, `${lc.name}_SPLIT_LOWER_INSET_${Math.round(insetPct * 100)}`, 'CAR');

          if (!upperCrop || !lowerCrop) return;

          const upperBuf = await preprocessImageToBuffer(rotatedCropBuffer, { crop: upperCrop, resizeWidth: 1800, processing });
          const lowerBuf = await preprocessImageToBuffer(rotatedCropBuffer, { crop: lowerCrop, resizeWidth: 1800, processing });

          const uMeta = await sharp(upperBuf).metadata();
          const lMeta = await sharp(lowerBuf).metadata();
          if ((uMeta.width || 0) < 3 || (uMeta.height || 0) < 3 || (lMeta.width || 0) < 3 || (lMeta.height || 0) < 3) return;

          if (isOcrBudgetExhausted(budget)) return;
          let uRaw = '';
          let uConfidence = 0;
          if (consumeOcrRun(budget)) {
            const runStart = Date.now();
            await setPsm(PSM.SINGLE_LINE);
            const uRes = await worker.recognize(upperBuf);
            uRaw = uRes.data.text || '';
            uConfidence = uRes.data.confidence;

            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][RUN] stage=TARGETED_TWO_LINE_SPLIT region=${lc.name} variant=${processing}-upper rotation=${angle} used=${budget.used}/${budget.max} elapsedMs=${Date.now() - runStart} raw="${uRaw.replace(/[\r\n]+/g, '\\n')}" normalized="" valid=false`);
            }
          } else {
            return;
          }

          const uSanit = uRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const uCorrected = correctUpperLineConfusions(uSanit);
          const isUpperValid = /^\d{2}[A-Z]$/.test(uCorrected);
          if (!isUpperValid) {
            carCandidates.push({
              normalizedPlate: '',
              formattedPlate: '',
              rawText: `${uRaw}\n`,
              confidence: uConfidence,
              cropName: lc.name,
              variantName: `${lc.name.toLowerCase()}-two-line-split-${processing.split('-').slice(1).join('-')}-inset-${Math.round(insetPct * 100)}-rot-${angle}-ratio-${ratio.name}`,
              valid: false,
              rejectionReason: `Upper line "${uCorrected}" (raw: "${uSanit}") does not match structure (SPLIT_LINES)`,
              orientationName,
              orientationWidth: width,
              orientationHeight: height,
              strategy: 'CAR_TWO_LINE_SPLIT'
            });
            return;
          }

          if (isOcrBudgetExhausted(budget)) return;
          let lRaw = '';
          let lConfidence = 0;
          if (consumeOcrRun(budget)) {
            const runStart = Date.now();
            await setPsm(PSM.SINGLE_LINE);
            const lRes = await worker.recognize(lowerBuf);
            lRaw = lRes.data.text || '';
            lConfidence = lRes.data.confidence;

            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][RUN] stage=TARGETED_TWO_LINE_SPLIT region=${lc.name} variant=${processing}-lower rotation=${angle} used=${budget.used}/${budget.max} elapsedMs=${Date.now() - runStart} raw="${lRaw.replace(/[\r\n]+/g, '\\n')}" normalized="" valid=false`);
            }
          } else {
            return;
          }

          const lSanit = lRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const lowerCands = getLowerLineCandidates(lSanit);
          if (lowerCands.length === 0) {
            carCandidates.push({
              normalizedPlate: '',
              formattedPlate: '',
              rawText: `${uRaw}\n${lRaw}`,
              confidence: Math.min(uConfidence, lConfidence),
              cropName: lc.name,
              variantName: `${lc.name.toLowerCase()}-two-line-split-${processing.split('-').slice(1).join('-')}-inset-${Math.round(insetPct * 100)}-rot-${angle}-ratio-${ratio.name}`,
              valid: false,
              rejectionReason: `No valid lower line candidates found from raw "${lSanit}" (SPLIT_LINES)`,
              orientationName,
              orientationWidth: width,
              orientationHeight: height,
              strategy: 'CAR_TWO_LINE_SPLIT'
            });
            return;
          }

          for (const lCand of lowerCands) {
            const combined = uCorrected + lCand;
            const isValid = isValidCarPlate(combined);

            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][RUN] stage=TARGETED_TWO_LINE_SPLIT region=${lc.name} variant=${processing}-split-combined rotation=${angle} used=${budget.used}/${budget.max} elapsedMs=0 raw="${uRaw.trim()}\\n${lRaw.trim()}" normalized="${combined}" valid=${isValid}`);
            }

            carCandidates.push({
              normalizedPlate: combined,
              formattedPlate: formatCarPlate(combined),
              rawText: `${uRaw}\n${lRaw}`,
              confidence: Math.min(uConfidence, lConfidence),
              cropName: lc.name,
              variantName: `${lc.name.toLowerCase()}-two-line-split-${processing.split('-').slice(1).join('-')}-inset-${Math.round(insetPct * 100)}-rot-${angle}-ratio-${ratio.name}`,
              valid: isValid,
              rejectionReason: isValid ? '' : 'Failed structural validation regex (SPLIT_LINES)',
              orientationName,
              orientationWidth: width,
              orientationHeight: height,
              strategy: 'CAR_TWO_LINE_SPLIT'
            });
          }
        } catch (e) {
          // Ignore
        }
      };

      // ─── STAGE A: FAST EXISTING CAR PASS ───
      if (isOcrBudgetExhausted(budget)) return false;
      const primaryCrop = (profile === 'PORTRAIT') ? carVariants[1].crop : carVariants[0].crop;
      const primaryCropName = (profile === 'PORTRAIT') ? carVariants[1].cropName : carVariants[0].cropName;
      
      if (primaryCrop && !isOcrBudgetExhausted(budget)) {
        await runPassForCrop(primaryCrop, 'grayscale-normalize-sharpen', primaryCropName, budget, 'STAGE_A_FAST_PASS');
      }
      if (primaryCrop && !isOcrBudgetExhausted(budget)) {
        await runPassForCrop(primaryCrop, 'grayscale-normalize-threshold', primaryCropName, budget, 'STAGE_A_FAST_PASS');
      }

      // One existing successful one-line recovery pass
      const yStart = profile === 'PORTRAIT' ? 0.35 : 0.42;
      const yEnd = profile === 'PORTRAIT' ? 0.75 : 0.88;
      const yHeight = yEnd - yStart;
      const centerRecCrop = getClampedCrop(0.22, yStart, 0.56, yHeight, 'CENTER_RECOVERY');
      if (centerRecCrop && !isOcrBudgetExhausted(budget)) {
        await runPassForCrop(centerRecCrop, 'grayscale-normalize-sharpen', 'CENTER_RECOVERY', budget, 'STAGE_A_FAST_PASS');
      }

      // Early exit Stage A standard crops
      let stageABest = getBestCandidateForOrientation(orientationName);
      if (stageABest && ((stageABest.agreementCount && stageABest.agreementCount >= 2) || stageABest.confidence >= 80)) {
        selectedCandidate = stageABest;
        return true;
      }

      // ─── STAGE B: LOW BOTTOM-CENTER PASS ───
      if (isOcrBudgetExhausted(budget)) return false;
      const centeredLowCrops = [
        { name: 'CAR_LOW_CENTER', crop: getClampedCrop(0.27, 0.65, 0.46, 0.30, 'CAR_LOW_CENTER') },
        { name: 'CAR_LOW_NARROW', crop: getClampedCrop(0.32, 0.70, 0.36, 0.25, 'CAR_LOW_NARROW') },
        { name: 'CAR_LOW_WIDE', crop: getClampedCrop(0.18, 0.55, 0.64, 0.40, 'CAR_LOW_WIDE') }
      ];

      const offCenterLowCrops = [
        { name: 'CAR_LOW_LEFT', crop: getClampedCrop(0.17, 0.63, 0.46, 0.34, 'CAR_LOW_LEFT') },
        { name: 'CAR_LOW_RIGHT', crop: getClampedCrop(0.37, 0.63, 0.46, 0.34, 'CAR_LOW_RIGHT') }
      ];

      const runStageBLowCrops = async (crops: typeof centeredLowCrops) => {
        for (const lc of crops) {
          if (isOcrBudgetExhausted(budget)) break;
          if (!lc.crop) continue;

          await runPassForCrop(lc.crop, 'grayscale-normalize-sharpen', lc.name, budget, 'STAGE_B_LOW_CENTER');
          if (isOcrBudgetExhausted(budget)) break;
          await runPassForCrop(lc.crop, 'grayscale-normalize-threshold', lc.name, budget, 'STAGE_B_LOW_CENTER');
        }
      };

      await runStageBLowCrops(centeredLowCrops);

      // If centered crops fail and budget/time remains, try off-center crops
      if (!isOcrBudgetExhausted(budget)) {
        let stageBBest = getBestCandidateForOrientation(orientationName);
        if (!stageBBest || !((stageBBest.agreementCount && stageBBest.agreementCount >= 2) || stageBBest.confidence >= 80)) {
          await runStageBLowCrops(offCenterLowCrops);
        }
      }

      // Early exit Stage B
      let stageBBest = getBestCandidateForOrientation(orientationName);
      if (stageBBest && ((stageBBest.agreementCount && stageBBest.agreementCount >= 2) || stageBBest.confidence >= 80)) {
        selectedCandidate = stageBBest;
        return true;
      }

      // ─── STAGE C: TARGETED TWO-LINE SPLIT ───
      if (isOcrBudgetExhausted(budget)) return false;
      const stageCCrops = [
        { name: 'CAR_LOW_CENTER', crop: getClampedCrop(0.27, 0.65, 0.46, 0.30, 'CAR_LOW_CENTER') },
        { name: 'CAR_LOW_NARROW', crop: getClampedCrop(0.32, 0.70, 0.36, 0.25, 'CAR_LOW_NARROW') }
      ];

      const primaryRatio = { upperPct: 0.48, lowerStartPct: 0.43, name: '45/55' };
      const secondaryRatios = [
        { upperPct: 0.43, lowerStartPct: 0.38, name: '40/60' },
        { upperPct: 0.53, lowerStartPct: 0.48, name: '50/50' }
      ];

      // Try primary ratio first on best centered low crop candidates
      for (const lc of stageCCrops) {
        if (isOcrBudgetExhausted(budget)) break;
        await runTargetedTwoLineSplit(lc, primaryRatio, 'grayscale-normalize-sharpen', 0);
        if (isOcrBudgetExhausted(budget)) break;
        await runTargetedTwoLineSplit(lc, primaryRatio, 'grayscale-normalize-threshold', 0);
      }

      // Try secondary ratios only if budget and deadline still permit
      if (!isOcrBudgetExhausted(budget)) {
        let stageCBest = getBestCandidateForOrientation(orientationName);
        if (!stageCBest || !((stageCBest.agreementCount && stageCBest.agreementCount >= 2) || stageCBest.confidence >= 80)) {
          for (const ratio of secondaryRatios) {
            for (const lc of stageCCrops) {
              if (isOcrBudgetExhausted(budget)) break;
              await runTargetedTwoLineSplit(lc, ratio, 'grayscale-normalize-sharpen', 0);
            }
          }
        }
      }

      // Early exit Stage C
      let stageCBest = getBestCandidateForOrientation(orientationName);
      if (stageCBest && ((stageCBest.agreementCount && stageCBest.agreementCount >= 2) || stageCBest.confidence >= 80)) {
        selectedCandidate = stageCBest;
        return true;
      }

      // ─── STAGE D: SMALL ROTATION FALLBACK ───
      if (isOcrBudgetExhausted(budget)) return false;
      const stageDAngles = [-2, 2];
      const bestLowCrop = { name: 'CAR_LOW_CENTER', crop: getClampedCrop(0.27, 0.65, 0.46, 0.30, 'CAR_LOW_CENTER') };

      if (bestLowCrop.crop) {
        for (const angle of stageDAngles) {
          if (isOcrBudgetExhausted(budget)) break;

          try {
            const rotatedCropBuffer = await sharp(buf)
              .extract(bestLowCrop.crop)
              .rotate(angle, { background: '#FFFFFF' })
              .toBuffer();

            // 1. One-line run on rotated crop
            if (!isOcrBudgetExhausted(budget)) {
              await runPassForRotatedCrop(rotatedCropBuffer, bestLowCrop.name, angle, 'grayscale-normalize-sharpen', budget, 'STAGE_D_ROTATION');
            }
            if (!isOcrBudgetExhausted(budget)) {
              await runPassForRotatedCrop(rotatedCropBuffer, bestLowCrop.name, angle, 'grayscale-normalize-threshold', budget, 'STAGE_D_ROTATION');
            }

            // 2. Split-line run on rotated crop
            if (!isOcrBudgetExhausted(budget)) {
              await runTargetedTwoLineSplit(bestLowCrop, primaryRatio, 'grayscale-normalize-sharpen', 0, angle);
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      // If still not found, check if there is substantial remaining budget (e.g. used < 15) to test -4 and 4 degrees
      if (!isOcrBudgetExhausted(budget) && budget.used < 15) {
        let stageDBest = getBestCandidateForOrientation(orientationName);
        if (!stageDBest || !((stageDBest.agreementCount && stageDBest.agreementCount >= 2) || stageDBest.confidence >= 80)) {
          const extraAngles = [-4, 4];
          for (const angle of extraAngles) {
            if (isOcrBudgetExhausted(budget)) break;
            if (!bestLowCrop.crop) continue;

            try {
              const rotatedCropBuffer = await sharp(buf)
                .extract(bestLowCrop.crop)
                .rotate(angle, { background: '#FFFFFF' })
                .toBuffer();

              if (!isOcrBudgetExhausted(budget)) {
                await runPassForRotatedCrop(rotatedCropBuffer, bestLowCrop.name, angle, 'grayscale-normalize-sharpen', budget, 'STAGE_D_ROTATION');
              }
            } catch (e) {
              // Ignore
            }
          }
        }
      }

      // Final fallback if nothing else worked
      let finalBest = getBestCandidateForOrientation(orientationName);
      if (finalBest) {
        selectedCandidate = finalBest;
        return true;
      }

      return false;
    };

    // 1. Run ORIGINAL orientation first
    let found = await evaluateOrientation(orientedBuffer, w, h, 'ORIGINAL', runBudget);

    // 2. Fallbacks if not found
    const isLandscape = (w / h) >= 1.15;
    if (!found && !isLandscape && !isOcrBudgetExhausted(runBudget)) {
      const fallbacks: { name: 'ROTATE_90_CW' | 'ROTATE_90_CCW' | 'ROTATE_180'; angle: number }[] = [
        { name: 'ROTATE_90_CW', angle: 90 },
        { name: 'ROTATE_90_CCW', angle: 270 },
        { name: 'ROTATE_180', angle: 180 },
      ];

      for (const f of fallbacks) {
        if (isOcrBudgetExhausted(runBudget)) break;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[OCR][CAR] Running fallback orientation: ${f.name}`);
        }
        try {
          const rotated = await getRotatedBuffer(imageBuffer, f.angle);
          
          const ratio = rotated.h / rotated.w;
          let rotProfile: 'PORTRAIT' | 'LANDSCAPE' | 'NEAR_SQUARE' = 'NEAR_SQUARE';
          if (ratio >= 1.15) {
            rotProfile = 'PORTRAIT';
          } else if (rotated.w / rotated.h >= 1.15) {
            rotProfile = 'LANDSCAPE';
          }

          let probeCropPct = { left: 0.18, top: 0.48, width: 0.64, height: 0.36 };
          if (rotProfile === 'PORTRAIT') {
            probeCropPct = { left: 0.17, top: 0.35, width: 0.66, height: 0.38 };
          } else if (rotProfile === 'NEAR_SQUARE') {
            probeCropPct = { left: 0.18, top: 0.40, width: 0.64, height: 0.40 };
          } else {
            probeCropPct = { left: 0.18, top: 0.48, width: 0.64, height: 0.36 };
          }

          const probeCropRaw = {
            left: Math.max(0, Math.floor(rotated.w * probeCropPct.left)),
            top: Math.max(0, Math.floor(rotated.h * probeCropPct.top)),
            width: Math.max(10, Math.floor(rotated.w * probeCropPct.width)),
            height: Math.max(10, Math.floor(rotated.h * probeCropPct.height)),
          };
          
          const probeCrop = clampCropRegion(probeCropRaw, rotated.w, rotated.h, 'CAR_MEDIUM_PROBE', 'CAR');
          
          if (!probeCrop) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][CAR] [${f.name}] Probe skipped: invalid crop bounds`);
            }
            continue;
          }

          const probeBuf = await preprocessImageToBuffer(rotated.buffer, {
            crop: probeCrop,
            resizeWidth: 1800,
            processing: 'grayscale-normalize-sharpen',
          });

          const pMeta = await sharp(probeBuf).metadata();
          const pW = pMeta.width || 0;
          const pH = pMeta.height || 0;
          const pValid = Number.isFinite(pW) && Number.isFinite(pH) && pW >= 3 && pH >= 3;

          if (!pValid) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][CAR] [${f.name}] Probe skipped: invalid processed dimensions`);
            }
            continue;
          }

          if (!consumeOcrRun(runBudget)) {
            continue;
          }
          await setPsm(PSM.SINGLE_LINE);
          const pRes = await worker.recognize(probeBuf);
          const pRawText = pRes.data.text || '';
          
          const extracted = extractCarCandidates(pRawText);
          const hasValidCandidate = extracted.some(ext => ext.valid);

          for (const ext of extracted) {
            carCandidates.push({
              normalizedPlate: ext.normalized,
              formattedPlate: formatCarPlate(ext.normalized),
              rawText: pRawText,
              confidence: pRes.data.confidence,
              cropName: 'CAR_MEDIUM_PROBE',
              variantName: 'car-medium-probe',
              valid: ext.valid,
              rejectionReason: ext.reason,
              orientationName: f.name,
              orientationWidth: rotated.w,
              orientationHeight: rotated.h,
              strategy: 'CAR_ONE_LINE',
            });
          }

          if (extracted.length === 0) {
            carCandidates.push({
              normalizedPlate: '',
              formattedPlate: '',
              rawText: pRawText,
              confidence: pRes.data.confidence,
              cropName: 'CAR_MEDIUM_PROBE',
              variantName: 'car-medium-probe',
              valid: false,
              rejectionReason: 'No valid plate length found in raw text',
              orientationName: f.name,
              orientationWidth: rotated.w,
              orientationHeight: rotated.h,
              strategy: 'CAR_ONE_LINE',
            });
          }

          if (hasValidCandidate) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][CAR] [${f.name}] Probe succeeded, running full cascade.`);
            }
            found = await evaluateOrientation(rotated.buffer, rotated.w, rotated.h, f.name, runBudget);
            if (found) {
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[OCR][CAR] Sufficiently supported plate found on fallback orientation: ${f.name}`);
              }
              break;
            }
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[OCR][CAR] [${f.name}] Probe did not find a valid plate candidate.`);
            }
          }
        } catch (e) {
          // Ignore orientation error
        }
      }
    }

    let validCarCandidates = carCandidates.filter(c => c.valid);

    // 3. Final Broad Full-Region Fallback before throwing HTTP 422
    if (validCarCandidates.length === 0 && !isOcrBudgetExhausted(runBudget)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[OCR][CAR] All primary & recovery regions failed. Running final broad full-region fallback...');
      }
      try {
        const fallbackCropRaw = {
          left: 0,
          top: Math.floor(h * 0.3),
          width: w,
          height: Math.floor(h * 0.6),
        };
        const fallbackCrop = clampCropRegion(fallbackCropRaw, w, h, 'CAR_BROAD_FULL_REGION', 'CAR');
        
        if (fallbackCrop) {
          const fbBuffer = await preprocessImageToBuffer(orientedBuffer, {
            crop: fallbackCrop,
            resizeWidth: 1800,
            processing: 'grayscale-normalize-sharpen',
          });

          const fbMeta = await sharp(fbBuffer).metadata();
          const fbW = fbMeta.width || 0;
          const fbH = fbMeta.height || 0;

          if (fbW >= 3 && fbH >= 3) {
            if (consumeOcrRun(runBudget)) {
              await setPsm(PSM.SPARSE_TEXT);
              const fbRes = await worker.recognize(fbBuffer);
              const fbRawText = fbRes.data.text || '';

              if (process.env.NODE_ENV !== 'production') {
                console.log(`[OCR][CAR] [BROAD_FULL_REGION] raw="${fbRawText.replace(/[\r\n]+/g, '\\n')}"`);
              }

              const extracted = extractCarCandidates(fbRawText);
              for (const ext of extracted) {
                carCandidates.push({
                  normalizedPlate: ext.normalized,
                  formattedPlate: formatCarPlate(ext.normalized),
                  rawText: fbRawText,
                  confidence: fbRes.data.confidence,
                  cropName: 'CAR_BROAD_FULL_REGION',
                  variantName: 'car-broad-sparse-text',
                  valid: ext.valid,
                  rejectionReason: ext.reason,
                  orientationName: 'ORIGINAL',
                  orientationWidth: w,
                  orientationHeight: h,
                  strategy: 'CAR_ONE_LINE',
                });
              }

              if (extracted.length === 0) {
                carCandidates.push({
                  normalizedPlate: '',
                  formattedPlate: '',
                  rawText: fbRawText,
                  confidence: fbRes.data.confidence,
                  cropName: 'CAR_BROAD_FULL_REGION',
                  variantName: 'car-broad-sparse-text',
                  valid: false,
                  rejectionReason: 'No valid plate length found in raw text',
                  orientationName: 'ORIGINAL',
                  orientationWidth: w,
                  orientationHeight: h,
                  strategy: 'CAR_ONE_LINE',
                });
              }

              const newValid = carCandidates.filter(c => c.valid);
              validCarCandidates.push(...newValid);
            }
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[OCR][CAR] Broad full-region fallback failed:', e);
        }
      }
    }

    // Group agreement globally across all candidate runs first to compute agreement counts
    const carAgreementMap = new Map<string, number>();
    for (const cand of validCarCandidates) {
      carAgreementMap.set(cand.normalizedPlate, (carAgreementMap.get(cand.normalizedPlate) || 0) + 1);
    }
    for (const cand of validCarCandidates) {
      cand.agreementCount = carAgreementMap.get(cand.normalizedPlate) || 1;
    }

    // Filter out unconfirmed window candidates that lack independent agreement
    validCarCandidates = validCarCandidates.filter(cand => {
      if (cand.isUnconfirmedWindow) {
        const agree = cand.agreementCount || 1;
        if (agree < 2) {
          cand.valid = false;
          cand.rejectionReason = 'Unconfirmed 5-digit window from 6-digit lower line lacks independent agreement';
          return false;
        }
      }
      return true;
    });

    // Re-calculate agreement counts after filtering
    carAgreementMap.clear();
    for (const cand of validCarCandidates) {
      carAgreementMap.set(cand.normalizedPlate, (carAgreementMap.get(cand.normalizedPlate) || 0) + 1);
    }
    for (const cand of validCarCandidates) {
      cand.agreementCount = carAgreementMap.get(cand.normalizedPlate) || 1;
    }

    if (validCarCandidates.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        const elapsed = Date.now() - startTime;
        console.log(`[OCR][CAR] final=NO_VALID_CANDIDATE elapsedMs=${elapsed} reason="No recognized candidates passed the strict CAR validation format."`);

        console.log('\n[CAR OCR Diagnostics Table (NO VALID CANDIDATES)]');
        console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------');
        console.log('| Orientation | Variant Name                 | Crop Name             | Raw OCR Text   | Sanitized  | Candidate  | Conf | Valid | Rejection Reason                     |');
        console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------');
        for (const cand of carCandidates) {
          const orientCol = cand.orientationName.padEnd(11);
          const nameCol = cand.variantName.padEnd(28);
          const cropCol = cand.cropName.padEnd(21);
          const rawCol = cand.rawText.replace(/[\n\r]+/g, ' ').slice(0, 14).padEnd(14);
          const sanitCol = cand.normalizedPlate.padEnd(10);
          const normCol = cand.normalizedPlate.padEnd(10);
          const confCol = Math.round(cand.confidence).toString().padStart(4);
          const validCol = cand.valid ? 'YES' : 'NO ';
          const reasonCol = cand.rejectionReason.padEnd(36);
          console.log(`| ${orientCol} | ${nameCol} | ${cropCol} | ${rawCol} | ${sanitCol} | ${normCol} | ${confCol} | ${validCol}   | ${reasonCol} |`);
        }
        console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------\n');
      }
      throw lastError || new AppError(422, 'Không nhận diện được biển số. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[OCR][CAR] --- Valid Candidate Groups ---');
      for (const [normalized, count] of carAgreementMap.entries()) {
        console.log(`[OCR][CAR] group="${normalized}" agreement=${count}`);
      }
    }

    if (!selectedCandidate) {
      const sortedCarCandidates = [...validCarCandidates].sort((a, b) => {
        const aLen = a.normalizedPlate.length;
        const bLen = b.normalizedPlate.length;
        if (aLen !== bLen) {
          return bLen - aLen;
        }

        const aAg = a.agreementCount || 0;
        const bAg = b.agreementCount || 0;
        if (aAg !== bAg) return bAg - aAg;

        return b.confidence - a.confidence;
      });
      selectedCandidate = sortedCarCandidates[0];
    }

    const selected = selectedCandidate;

    if (process.env.NODE_ENV !== 'production') {
      console.log('\n[CAR OCR Diagnostics Table]');
      console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------');
      console.log('| Orientation | Variant Name                 | Crop Name             | Raw OCR Text   | Sanitized  | Candidate  | Conf | Valid | Agreement | Selected | Strategy |');
      console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------');
      for (const cand of carCandidates) {
        const isSelected = cand.valid && selected && cand.normalizedPlate === selected.normalizedPlate && cand.variantName === selected.variantName && cand.orientationName === selected.orientationName ? 'SELECTED' : 'REJECTED';
        const orientCol = cand.orientationName.padEnd(11);
        const nameCol = cand.variantName.padEnd(28);
        const cropCol = cand.cropName.padEnd(21);
        const rawCol = cand.rawText.replace(/[\n\r]+/g, ' ').slice(0, 14).padEnd(14);
        const sanitCol = cand.normalizedPlate.padEnd(10);
        const normCol = cand.normalizedPlate.padEnd(10);
        const confCol = Math.round(cand.confidence).toString().padStart(4);
        const validCol = cand.valid ? 'YES' : 'NO ';
        const agreeCol = cand.valid ? (cand.agreementCount || 1).toString().padStart(9) : '        -';
        const stratCol = (cand.strategy || 'CAR_ONE_LINE').padEnd(18);
        console.log(`| ${orientCol} | ${nameCol} | ${cropCol} | ${rawCol} | ${sanitCol} | ${normCol} | ${confCol} | ${validCol}   | ${agreeCol} | ${isSelected.padEnd(8)} | ${stratCol} |`);
      }
      console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------\n');
    }

    let reliability: OcrReliability = 'REVIEW';
    if ((selected.agreementCount && selected.agreementCount >= 2) || selected.confidence >= 80) {
      reliability = 'VERIFIED';
    }

    if (process.env.NODE_ENV !== 'production') {
      const elapsed = Date.now() - startTime;
      console.log(`[OCR] selectedCandidate=${selected.normalizedPlate} runsUsed=${runBudget.used} elapsedMs=${elapsed}`);
    }

    return {
      rawText: selected.rawText,
      normalizedPlate: selected.normalizedPlate,
      candidates: [selected.formattedPlate],
      provider: 'TESSERACT_JS',
      confidence: selected.confidence,
      reliability,
      agreementCount: selected.agreementCount || 1,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const err = error as Error;
    console.error('[OCR] Tesseract processing error:', err.message);
    if (workerInstance) {
      try {
        await workerInstance.terminate();
      } catch (e) {
        // Ignore
      }
      workerInstance = null;
      lastPsm = null;
    }
    throw new AppError(503, 'Dịch vụ nhận diện biển số tạm thời chưa sẵn sàng. Vui lòng thử lại.');
  }
}

let ocrQueueChain = Promise.resolve();

export async function recognizeLicensePlate(imageBuffer: Buffer, vehicleType: 'CAR' | 'MOTORBIKE' = 'CAR'): Promise<PlateRecognitionResult> {
  return new Promise<PlateRecognitionResult>((resolve, reject) => {
    ocrQueueChain = ocrQueueChain.then(async () => {
      try {
        const res = await performOcr(imageBuffer, vehicleType);
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
}

export function reconcilePlates(
  frontNormalized: string,
  frontConf: number,
  rearNormalized: string,
  rearConf: number,
  vehicleType: 'CAR' | 'MOTORBIKE'
): {
  bestPlate: string;
  normalizedPlate: string;
  sourceUsed: 'FRONT' | 'REAR' | 'MERGED';
  confidence: number;
} {
  if (!frontNormalized && !rearNormalized) {
    return { bestPlate: '', normalizedPlate: '', sourceUsed: 'REAR', confidence: 0 };
  }
  if (!frontNormalized) {
    return {
      bestPlate: vehicleType === 'CAR' ? formatCarPlate(rearNormalized) : rearNormalized,
      normalizedPlate: rearNormalized,
      sourceUsed: 'REAR',
      confidence: rearConf,
    };
  }
  if (!rearNormalized) {
    return {
      bestPlate: vehicleType === 'CAR' ? formatCarPlate(frontNormalized) : frontNormalized,
      normalizedPlate: frontNormalized,
      sourceUsed: 'FRONT',
      confidence: frontConf,
    };
  }
  if (frontNormalized === rearNormalized) {
    return {
      bestPlate: vehicleType === 'CAR' ? formatCarPlate(rearNormalized) : rearNormalized,
      normalizedPlate: rearNormalized,
      sourceUsed: 'MERGED',
      confidence: Math.max(frontConf, rearConf),
    };
  }

  if (vehicleType === 'CAR') {
    const isFrontCar = /^\d{2}[A-Z]\d{5}$/.test(frontNormalized);
    const isRearCar = /^\d{2}[A-Z]\d{5}$/.test(rearNormalized);

    if (isFrontCar && isRearCar) {
      const frontUpper = frontNormalized.slice(0, 3);
      const frontLower = frontNormalized.slice(3);
      const rearUpper = rearNormalized.slice(0, 3);
      const rearLower = rearNormalized.slice(3);

      // Compare upper lines
      let bestUpper = '';
      if (frontUpper === rearUpper) {
        bestUpper = frontUpper;
      } else {
        bestUpper = frontConf >= rearConf ? frontUpper : rearUpper;
      }

      // Compare lower lines
      let bestLower = '';
      if (frontLower === rearLower) {
        bestLower = frontLower;
      } else {
        let diffCount = 0;
        let diffIdx = -1;
        for (let i = 0; i < 5; i++) {
          if (frontLower[i] !== rearLower[i]) {
            diffCount++;
            diffIdx = i;
          }
        }

        if (diffCount === 1) {
          const fc = frontLower[diffIdx];
          const rc = rearLower[diffIdx];

          const isCommonConfusion = (
            (fc === '8' && rc === '3') || (fc === '3' && rc === '8') ||
            (fc === '8' && rc === '5') || (fc === '5' && rc === '8') ||
            (fc === '6' && rc === '8') || (fc === '8' && rc === '6') ||
            (fc === '2' && rc === '7') || (fc === '7' && rc === '2') ||
            (fc === '0' && rc === '8') || (fc === '8' && rc === '0') ||
            (fc === '1' && rc === '7') || (fc === '7' && rc === '1')
          );

          if (frontConf >= rearConf) {
            bestLower = frontLower;
          } else {
            bestLower = rearLower;
          }
        } else {
          bestLower = frontConf >= rearConf ? frontLower : rearLower;
        }
      }

      const mergedNorm = bestUpper + bestLower;
      return {
        bestPlate: formatCarPlate(mergedNorm),
        normalizedPlate: mergedNorm,
        sourceUsed: 'MERGED',
        confidence: Math.max(frontConf, rearConf),
      };
    }
  }

  const chosenNorm = frontConf >= rearConf ? frontNormalized : rearNormalized;
  return {
    bestPlate: vehicleType === 'CAR' ? formatCarPlate(chosenNorm) : chosenNorm,
    normalizedPlate: chosenNorm,
    sourceUsed: frontConf >= rearConf ? 'FRONT' : 'REAR',
    confidence: Math.max(frontConf, rearConf),
  };
}

