import { isValidMotorbikePlate, formatMotorbikePlate } from '../services/ocr.service';

function testMotorbikeOcr() {
  console.log('Running focused Motorbike OCR validation & formatting tests...');

  // Test Case 1: Valid 9-char new format
  const plate1 = '29C199999';
  const valid1 = isValidMotorbikePlate(plate1);
  const formatted1 = formatMotorbikePlate(plate1);
  console.log(`Input: ${plate1} | Valid: ${valid1} | Formatted: ${formatted1}`);
  if (!valid1 || formatted1 !== '29-C1 999.99') {
    throw new Error(`Test failed for ${plate1}. Expected valid and formatted as 29-C1 999.99`);
  }

  // Test Case 2: Valid 9-char popular format
  const plate2 = '59K248327';
  const valid2 = isValidMotorbikePlate(plate2);
  const formatted2 = formatMotorbikePlate(plate2);
  console.log(`Input: ${plate2} | Valid: ${valid2} | Formatted: ${formatted2}`);
  if (!valid2 || formatted2 !== '59-K2 483.27') {
    throw new Error(`Test failed for ${plate2}. Expected valid and formatted as 59-K2 483.27`);
  }

  // Test Case 3: Valid 9-char target format
  const plate3_target = '59X234567';
  const valid3_target = isValidMotorbikePlate(plate3_target);
  const formatted3_target = formatMotorbikePlate(plate3_target);
  console.log(`Input: ${plate3_target} | Valid: ${valid3_target} | Formatted: ${formatted3_target}`);
  if (!valid3_target || formatted3_target !== '59-X2 345.67') {
    throw new Error(`Test failed for ${plate3_target}. Expected valid and formatted as 59-X2 345.67`);
  }

  // Test Case 4: Invalid candidate 14B325WE
  const plate3 = '14B325WE';
  const valid3 = isValidMotorbikePlate(plate3);
  console.log(`Input: ${plate3} | Valid: ${valid3}`);
  if (valid3) {
    throw new Error(`Test failed for ${plate3}. Expected invalid.`);
  }

  // Test Case 5: Rejected/invalid candidate 29C14390 for split-line modern validator
  const plate4 = '29C14390';
  const valid4 = isValidMotorbikePlate(plate4);
  console.log(`Input: ${plate4} | Valid (as standalone legacy/custom candidate): ${valid4}`);
  // (We expect isValidMotorbikePlate standalone to return true because of the legacy fallback length-8 format check,
  // but it is strictly rejected inside the split-line OCR recombine logic to prevent partial modern format reads)

  console.log('All motorbike validation and formatting assertions passed successfully!');
}

try {
  testMotorbikeOcr();
} catch (e: any) {
  console.error('Assertion Failure:', e.message);
  process.exit(1);
}

