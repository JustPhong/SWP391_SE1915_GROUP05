/**
 * Single source of truth for Vietnamese license plate validation.
 * Province code (2 digits) is validated; remaining characters are free-form.
 * Car:  2 digits + anything  (e.g. 51K-123.45, 29-1234)
 * Bike: 2 digits + anything  (e.g. 59-AB 234.56, 01-12345)
 */

const CAR_REGEX       = /^\d{2}.+$/;
const MOTORBIKE_REGEX = /^\d{2}.+$/;

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
      return { valid: false, message: 'Biển ô tô không hợp lệ. Phải bắt đầu bằng 2 số tỉnh (ví dụ: 51K-123.45).' };
    }
  } else if (vehicleType === 'MOTORBIKE') {
    if (!MOTORBIKE_REGEX.test(normalize(s))) {
      return { valid: false, message: 'Biển xe máy không hợp lệ. Phải bắt đầu bằng 2 số tỉnh (ví dụ: 59-AB 234.56).' };
    }
  } else {
    // Validate against BOTH — accept if either matches
    const norm = normalize(s);
    if (!CAR_REGEX.test(norm) && !MOTORBIKE_REGEX.test(norm)) {
      return {
        valid: false,
        message: 'Biển số không hợp lệ. Phải bắt đầu bằng 2 số tỉnh (ví dụ: 51K-123.45 hoặc 59-AB 234.56).',
      };
    }
  }

  return { valid: true };
}
