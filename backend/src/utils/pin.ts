import { randomInt } from 'crypto';

/**
 * Generates a secure, 6-digit numeric backup PIN string (000000 to 999999).
 * Preserves leading zeroes and does not use Math.random.
 */
export function generateMonthlyAccessPin(): string {
  const pinNum = randomInt(0, 1000000);
  return pinNum.toString().padStart(6, '0');
}
