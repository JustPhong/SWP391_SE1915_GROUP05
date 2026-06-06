/**
 * Single source of truth for Vietnamese license plate validation.
 * Car:  2 digits + 1 letter + '-' + 3 digits + '.' + 2 digits  (e.g. 51K-123.45)
 * Bike: 2 digits + '-' + 2 letters (or letter+digit) + space + 3 digits + '.' + 2 digits (e.g. 59-AB 234.56)
 */

const CAR_REGEX    = /^\d{2}[A-Z]-\d{3}\.\d{2}$/;
const MOTORBIKE_REGEX = /^\d{2}-([A-Z]{2}|[A-Z]\d)\s\d{3}\.\d{2}$/;

export function normalize(s: string): string {
  return s.trim().toUpperCase();
}

/** Returns { valid: true } or { valid: false, message: string } */
export function validatePlate(
  raw: string,
  vehicleType: 'CAR' | 'MOTORBIKE' | 'ALL' = 'ALL'
): { valid: boolean; message?: string } {
  const s = raw.trim();

  if (!s) {
    return { valid: false, message: 'Vui lòng nhập biển số xe.' };
  }

  if (vehicleType === 'CAR') {
    if (!CAR_REGEX.test(normalize(s))) {
      return { valid: false, message: 'Biển ô tô không hợp lệ. Định dạng đúng: 51K-123.45' };
    }
  } else if (vehicleType === 'MOTORBIKE') {
    if (!MOTORBIKE_REGEX.test(normalize(s))) {
      return { valid: false, message: 'Biển xe máy không hợp lệ. Định dạng đúng: 59-AB 234.56' };
    }
  } else {
    // Validate against BOTH — accept if either matches
    const norm = normalize(s);
    if (!CAR_REGEX.test(norm) && !MOTORBIKE_REGEX.test(norm)) {
      return {
        valid: false,
        message: 'Biển số không hợp lệ. Định dạng: 51K-123.45 (ô tô) hoặc 59-AB 234.56 (xe máy).',
      };
    }
  }

  return { valid: true };
}
