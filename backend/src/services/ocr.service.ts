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

  const digitConfusions: { [key: string]: string } = { 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'O': '0' };
  const letterConfusions: { [key: string]: string } = { '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '0': 'O' };

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
  return /^\d{2}[A-Z][A-Z0-9]{4,6}$/.test(p);
}

function formatCarPlate(p: string): string {
  const province = p.slice(0, 2);
  const letterMatch = p.match(/^[0-9]{2}([A-Z]+)/);
  const letter = letterMatch ? letterMatch[1] : '';
  const remaining = p.slice(2 + letter.length);

  let formatted = `${province}${letter}-${remaining}`;
  if (remaining.length === 5) {
    const firstThree = remaining.slice(0, 3);
    const lastTwo = remaining.slice(3);
    formatted = `${province}${letter}-${firstThree}.${lastTwo}`;
  }
  return formatted;
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

  pipeline = pipeline.rotate();

  if (options.resizeWidth) {
    pipeline = pipeline.resize(options.resizeWidth);
  }

  if (options.processing === 'grayscale-normalize-threshold') {
    pipeline = pipeline.grayscale().normalize().threshold(128);
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
    throw new OcrExtractionError(422, 'Không nhận diện được biển số từ ảnh sau. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.', rawText);
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
    throw new OcrExtractionError(422, 'Không nhận diện được biển số từ ảnh sau. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.', rawText);
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

async function performOcr(filePath: string, vehicleType: 'CAR' | 'MOTORBIKE' = 'CAR'): Promise<PlateRecognitionResult> {
  if (!fs.existsSync(filePath)) {
    throw new AppError(400, 'Không tìm thấy file ảnh để nhận diện.');
  }

  const worker = await getWorker();
  const startTime = Date.now();

  try {
    const imageBuffer = await fs.promises.readFile(filePath);
    const meta = await sharp(imageBuffer).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;

    const setPsm = async (psm: PSM) => {
      if (lastPsm !== psm) {
        await worker.setParameters({
          tessedit_pageseg_mode: psm,
        });
        lastPsm = psm;
      }
    };

    if (vehicleType === 'MOTORBIKE') {
      const motorbikeCrop = w > 0 && h > 0 ? {
        left: Math.floor(w * 0.32),
        top: Math.floor(h * 0.55),
        width: Math.floor(w * 0.36),
        height: Math.floor(h * 0.35),
      } : undefined;

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
          const blockBuffer = await preprocessImageToBuffer(imageBuffer, {
            crop: motorbikeCrop,
            resizeWidth: 1200,
            processing: variant.processing,
            metadata: meta,
          });

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
        if (motorbikeCrop) {
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

            const topBuffer = await preprocessImageToBuffer(imageBuffer, {
              crop: topCrop,
              resizeWidth: 1200,
              processing: variant.processing,
              metadata: meta,
            });
            await setPsm(PSM.SINGLE_LINE);
            const topRes = await worker.recognize(topBuffer);
            const topTextRaw = topRes.data.text || '';
            const topClean = topTextRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase();

            const bottomBuffer = await preprocessImageToBuffer(imageBuffer, {
              crop: bottomCrop,
              resizeWidth: 1200,
              processing: variant.processing,
              metadata: meta,
            });
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
      }

      if (motorbikeCandidates.length === 0) {
        throw lastError || new AppError(422, 'Không nhận diện được biển số từ ảnh sau. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.');
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

    const tightCrop = w > 0 && h > 0 ? {
      left: Math.floor(w * 0.3),
      top: Math.floor(h * 0.66),
      width: Math.floor(w * 0.4),
      height: Math.floor(h * 0.2),
    } : undefined;

    interface OcrVariant {
      name: string;
      crop?: { left: number; top: number; width: number; height: number };
      resizeWidth?: number;
      processing: string;
      psm: PSM;
    }

    const variants: OcrVariant[] = [
      {
        name: 'fast-pass',
        crop: tightCrop,
        resizeWidth: 1800,
        processing: 'grayscale-normalize-sharpen',
        psm: PSM.SINGLE_LINE,
      },
      {
        name: 'plate-tight-v2',
        crop: tightCrop,
        resizeWidth: 1800,
        processing: 'grayscale-normalize-threshold',
        psm: PSM.SINGLE_LINE,
      },
      {
        name: 'plate-tight-v3',
        crop: tightCrop,
        resizeWidth: 1800,
        processing: 'grayscale-linear-sharpen',
        psm: PSM.SINGLE_LINE,
      },
      {
        name: 'plate-very-tight-v1',
        crop: w > 0 && h > 0 ? {
          left: Math.floor(w * 0.345),
          top: Math.floor(h * 0.70),
          width: Math.floor(w * 0.31),
          height: Math.floor(h * 0.14),
        } : undefined,
        resizeWidth: 1800,
        processing: 'grayscale-normalize-sharpen',
        psm: PSM.SINGLE_LINE,
      },
      {
        name: 'plate-very-tight-v2',
        crop: w > 0 && h > 0 ? {
          left: Math.floor(w * 0.345),
          top: Math.floor(h * 0.70),
          width: Math.floor(w * 0.31),
          height: Math.floor(h * 0.14),
        } : undefined,
        resizeWidth: 1800,
        processing: 'grayscale-normalize-threshold',
        psm: PSM.SINGLE_LINE,
      },
      {
        name: 'plate-very-tight-v3',
        crop: w > 0 && h > 0 ? {
          left: Math.floor(w * 0.345),
          top: Math.floor(h * 0.70),
          width: Math.floor(w * 0.31),
          height: Math.floor(h * 0.14),
        } : undefined,
        resizeWidth: 1800,
        processing: 'grayscale-linear-sharpen',
        psm: PSM.SINGLE_LINE,
      },
      {
        name: 'lower-center-crop',
        crop: w > 0 && h > 0 ? {
          left: Math.floor(w * 0.25),
          top: Math.floor(h * 0.55),
          width: Math.floor(w * 0.5),
          height: Math.floor(h * 0.35),
        } : undefined,
        resizeWidth: 800,
        processing: 'grayscale-normalize-sharpen',
        psm: PSM.SPARSE_TEXT,
      },
      {
        name: 'wider-lower-crop',
        crop: w > 0 && h > 0 ? {
          left: Math.floor(w * 0.15),
          top: Math.floor(h * 0.45),
          width: Math.floor(w * 0.7),
          height: Math.floor(h * 0.45),
        } : undefined,
        resizeWidth: 1000,
        processing: 'grayscale-normalize-sharpen',
        psm: PSM.SPARSE_TEXT,
      },
      {
        name: 'full-enhanced',
        crop: undefined,
        resizeWidth: w < 800 ? 1200 : undefined,
        processing: 'grayscale-normalize-sharpen',
        psm: PSM.AUTO,
      }
    ];

    interface OcrPassResult {
      variantName: string;
      rawText: string;
      normalizedPlate: string;
      candidates: string[];
      confidence: number;
    }

    const successfulPasses: OcrPassResult[] = [];
    let lastError: Error | null = null;

    // Fast-pass-first strategy optimization:
    // If the very first variant ('fast-pass') returns a normalized plate with confidence >= 80,
    // AND it is not an incomplete motorcycle plate, we can skip other fallbacks to save time.
    try {
      const fastVariant = variants[0];
      const buffer = await preprocessImageToBuffer(imageBuffer, {
        crop: fastVariant.crop,
        resizeWidth: fastVariant.resizeWidth,
        processing: fastVariant.processing,
        metadata: meta,
      });
      await setPsm(fastVariant.psm);
      const res = await recognizeProcessedPlate(buffer, worker);
      if (res.normalizedPlate && /^\d{2}[A-Z][A-Z0-9]{4,6}$/.test(res.normalizedPlate)) {
        const isTwoLineMotorbike = vehicleType === 'MOTORBIKE' && (res.rawText.includes('\n') || res.rawText.split('\n').filter(l => l.trim().length > 0).length >= 2);
        const isReliable = res.confidence >= 80;
        const skipFallback = isReliable && !(vehicleType === 'MOTORBIKE' && !isTwoLineMotorbike);

        successfulPasses.push({
          variantName: fastVariant.name,
          rawText: res.rawText,
          normalizedPlate: res.normalizedPlate,
          candidates: res.candidates,
          confidence: res.confidence,
        });

        if (skipFallback) {
          if (process.env.NODE_ENV !== 'production') {
            const duration = Date.now() - startTime;
            console.log(`[OCR] Fast pass succeeded with high confidence in ${duration}ms. Plate: ${res.normalizedPlate}`);
          }
          return {
            rawText: res.rawText,
            normalizedPlate: res.normalizedPlate,
            candidates: res.candidates,
            provider: 'TESSERACT_JS',
            confidence: res.confidence,
            reliability: 'VERIFIED',
            agreementCount: 1,
          };
        }
      }
    } catch (err) {
      lastError = err as Error;
    }

    // Run the remaining fallback variants
    const startIdx = successfulPasses.length > 0 ? 1 : 0;
    for (let i = startIdx; i < variants.length; i++) {
      const v = variants[i];
      try {
        const buffer = await preprocessImageToBuffer(imageBuffer, {
          crop: v.crop,
          resizeWidth: v.resizeWidth,
          processing: v.processing,
          metadata: meta,
        });
        await setPsm(v.psm);
        const res = await recognizeProcessedPlate(buffer, worker);
        if (res.normalizedPlate && /^\d{2}[A-Z][A-Z0-9]{4,6}$/.test(res.normalizedPlate)) {
          successfulPasses.push({
            variantName: v.name,
            rawText: res.rawText,
            normalizedPlate: res.normalizedPlate,
            candidates: res.candidates,
            confidence: res.confidence,
          });
        }
      } catch (err) {
        lastError = err as Error;
      }
    }

    if (successfulPasses.length === 0) {
      throw lastError || new AppError(422, 'Không nhận diện được biển số từ ảnh sau. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.');
    }

    // Group successful passes by normalizedPlate
    const groups = new Map<string, OcrPassResult[]>();
    for (const pass of successfulPasses) {
      const list = groups.get(pass.normalizedPlate) || [];
      list.push(pass);
      groups.set(pass.normalizedPlate, list);
    }

    // Find the strongest unique normalized plate
    let bestNormalized: string | null = null;
    let bestAgreement = 0;
    let bestPass: OcrPassResult | null = null;

    for (const [normalized, passes] of groups.entries()) {
      const agreement = passes.length;
      // Representative pass is the one with the highest confidence in the group
      const representative = passes.reduce((prev, curr) => (curr.confidence > prev.confidence ? curr : prev), passes[0]);

      if (agreement > bestAgreement) {
        bestNormalized = normalized;
        bestAgreement = agreement;
        bestPass = representative;
      } else if (agreement === bestAgreement && bestPass && representative.confidence > bestPass.confidence) {
        bestNormalized = normalized;
        bestPass = representative;
      }
    }

    if (!bestNormalized || !bestPass) {
      throw new AppError(422, 'Không nhận diện được biển số từ ảnh sau. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.');
    }

    // Determine reliability
    // VERIFIED if:
    // - agreementCount >= 2
    // - OR: the representative pass is high-quality (confidence >= 80)
    let reliability: OcrReliability = 'REVIEW';
    if (bestAgreement >= 2 || bestPass.confidence >= 80) {
      reliability = 'VERIFIED';
    }

    if (process.env.NODE_ENV !== 'production') {
      const duration = Date.now() - startTime;
      console.log(`[OCR] Done in ${duration}ms. Selected: ${bestNormalized}, Agreement: ${bestAgreement}, Confidence: ${bestPass.confidence}%, Reliability: ${reliability}`);
    }

    return {
      rawText: bestPass.rawText,
      normalizedPlate: bestNormalized,
      candidates: bestPass.candidates,
      provider: 'TESSERACT_JS',
      confidence: bestPass.confidence,
      reliability,
      agreementCount: bestAgreement,
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

export async function recognizeLicensePlate(filePath: string, vehicleType: 'CAR' | 'MOTORBIKE' = 'CAR'): Promise<PlateRecognitionResult> {
  return new Promise<PlateRecognitionResult>((resolve, reject) => {
    ocrQueueChain = ocrQueueChain.then(async () => {
      try {
        const res = await performOcr(filePath, vehicleType);
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
}
