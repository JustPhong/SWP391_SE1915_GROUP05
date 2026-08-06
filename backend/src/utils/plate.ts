/**
 * Strips all non-alphanumeric characters, converts to uppercase, and trims whitespace.
 * e.g., "51A-731.89" -> "51A73189"
 */
export function normalizeLicensePlate(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
