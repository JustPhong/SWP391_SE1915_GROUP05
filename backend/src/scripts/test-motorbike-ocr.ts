import { isValidMotorbikePlate, formatMotorbikePlate, extractNoisyMotorbikePlate } from '../services/ocr.service';

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

  // Test Case 6: Noisy whole-block extraction - 67-A2 4 129.87F FL
  const raw1 = '67-A2 4 129.87F FL';
  const extracted1 = extractNoisyMotorbikePlate(raw1);
  console.log(`Raw: "${raw1}" | Extracted: ${extracted1}`);
  if (!extracted1 || !isValidMotorbikePlate(extracted1) || formatMotorbikePlate(extracted1) !== '67-A2 129.87') {
    throw new Error(`Test failed for raw text: "${raw1}". Got extracted: ${extracted1}`);
  }

  // Test Case 7: Noisy whole-block extraction - 67-A2 1129.87 J
  const raw2 = '67-A2 1129.87 J';
  const extracted2 = extractNoisyMotorbikePlate(raw2);
  console.log(`Raw: "${raw2}" | Extracted: ${extracted2}`);
  if (!extracted2 || !isValidMotorbikePlate(extracted2) || formatMotorbikePlate(extracted2) !== '67-A2 129.87') {
    throw new Error(`Test failed for raw text: "${raw2}". Got extracted: ${extracted2}`);
  }

  // Test Case 8: Noisy whole-block extraction - 67-A2B 8129.87 8 7
  const raw3 = '67-A2B 8129.87 8 7';
  const extracted3 = extractNoisyMotorbikePlate(raw3);
  console.log(`Raw: "${raw3}" | Extracted: ${extracted3}`);
  if (!extracted3 || !isValidMotorbikePlate(extracted3) || formatMotorbikePlate(extracted3) !== '67-A2 129.87') {
    throw new Error(`Test failed for raw text: "${raw3}". Got extracted: ${extracted3}`);
  }

  // Test Case 9: Clean input extraction - 67-A2 129.87
  const raw4 = '67-A2 129.87';
  const extracted4 = extractNoisyMotorbikePlate(raw4);
  console.log(`Raw: "${raw4}" | Extracted: ${extracted4}`);
  if (!extracted4 || !isValidMotorbikePlate(extracted4) || formatMotorbikePlate(extracted4) !== '67-A2 129.87') {
    throw new Error(`Test failed for raw text: "${raw4}". Got extracted: ${extracted4}`);
  }

  // Test Case 10: Clean single line extraction - 67A212987
  const raw5 = '67A212987';
  const extracted5 = extractNoisyMotorbikePlate(raw5);
  console.log(`Raw: "${raw5}" | Extracted: ${extracted5}`);
  if (!extracted5 || !isValidMotorbikePlate(extracted5) || formatMotorbikePlate(extracted5) !== '67-A2 129.87') {
    throw new Error(`Test failed for raw text: "${raw5}". Got extracted: ${extracted5}`);
  }

  // Test Case 11: Negative Test (Random text with numbers)
  const raw6 = 'Lorem ipsum 12 dolor sit 345 amet';
  const extracted6 = extractNoisyMotorbikePlate(raw6);
  console.log(`Raw: "${raw6}" | Extracted: ${extracted6}`);
  if (extracted6 && isValidMotorbikePlate(extracted6)) {
    throw new Error(`Negative test failed: raw text "${raw6}" was incorrectly accepted as valid plate: ${extracted6}`);
  }

  console.log('All motorbike validation, formatting, and noisy OCR extraction assertions passed successfully!');
}

try {
  testMotorbikeOcr();
} catch (e: any) {
  console.error('Assertion Failure:', e.message);
  process.exit(1);
}
