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

export function formatPlateNumber(val: string, prevVal: string = ''): string {
  // Convert to uppercase, decompose, and strip diacritical marks/Vietnamese characters to ASCII
  let normalized = val.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D');

  // Keep only alphanumeric characters
  let clean = normalized.replace(/[^A-Z0-9]/g, '');

  if (clean.length <= 2) {
    return clean;
  }

  // Check if first 2 characters are numbers (province code)
  const isProvNum = /^[0-9]{2}/.test(clean);
  if (!isProvNum) {
    return clean;
  }

  // Explicitly handle the common structure: XXA-12345  (e.g. 79C-76767)
  // That means clean looks like: [0..1]=XX, [2]=Letter, [3..] = 5 digits (total length = 8)
  const matchCommon = clean.match(/^(\d{2})([A-Z])(\d{5})/);
  if (matchCommon) {
    return `${matchCommon[1]}${matchCommon[2]}-${matchCommon[3]}`;
  }

  // Detect backspace/deletion (keep it minimal to avoid interfering with the common XXA-12345 rule)
  // If the previous value ended with a hyphen and the user deleted it, just continue formatting from the new raw value.
  if (prevVal.endsWith('-') && val === prevVal.slice(0, -1)) {
    return formatPlateNumber(val, '');
  }

  const char3 = clean[2];
  const char4 = clean[3];

  const isChar3Letter = /[A-Z]/.test(char3);
  const isChar4Letter = char4 && /[A-Z]/.test(char4);

  if (isChar3Letter) {
    if (isChar4Letter) {
      // 4-character prefix (e.g. 51LD, 30AA)
      return clean.slice(0, 4) + (clean.length > 4 ? '-' + clean.slice(4) : '-');
    } else {
      // 3-character prefix (e.g. 30A, 51F)
      return clean.slice(0, 3) + (clean.length > 3 ? '-' + clean.slice(3) : '-');
    }
  }

  // If 3rd char is not a letter, fallback
  return clean.slice(0, 2) + '-' + clean.slice(2);
}

export function normalizePlateForApi(s: string): string {
  return normalize(s).replace(/[-.\s]/g, '');
}

