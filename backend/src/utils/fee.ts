/**
 * Vietnamese parking fee calculator.
 *
 * MOTORBIKE  (ceil lots of 4h):
 *   Ban ngày  06:00–17:59  →  3.000đ / 4h
 *   Ban đêm   18:00–05:59  →  4.000đ / 4h
 *
 * CAR  (ceil lots of 2h, except flat night):
 *   Ban ngày  06:00–17:59  →  15.000đ / 2h
 *   Buổi tối 18:00–23:59  →  20.000đ / 2h
 *   Đêm muộn  00:00–05:59  →  100.000đ FLAT (if session touches it)
 */

export interface FeeBlock {
  startTime: Date;
  endTime: Date;
  label: string;
  minutesInBlock: number;
  rate: number;
  lotHours: number;
  lots: number;
  amount: number;
  note?: string;
}

export interface FeeResult {
  total: number;
  breakdown: FeeBlock[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ceilLots(minutes: number, lotMinutes: number): number {
  return Math.ceil(minutes / lotMinutes);
}

/** Which block index is active at a given local-clock minute-of-day [0,1440)? */
type BlockDef = {
  label: string;
  startHour: number;   // inclusive
  endHour: number;     // exclusive; 24 means end-of-day
  rate: number;
  lotMinutes: number;
};

function getBlockIndex(minuteOfDay: number, blocks: BlockDef[]): number {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.startHour < b.endHour) {
      // Normal block e.g. 06:00–18:00
      if (minuteOfDay >= b.startHour * 60 && minuteOfDay < b.endHour * 60) return i;
    } else {
      // Wrap-around e.g. 18:00–06:00
      if (minuteOfDay >= b.startHour * 60 || minuteOfDay < b.endHour * 60) return i;
    }
  }
  return -1;
}

/**
 * Walk [sessionStart, sessionEnd) using whole-hour jumps.
 * Whenever the block index changes, close the current slice and start a new one.
 * The cursor advances to the end of the current block or sessionEnd, whichever is sooner.
 */
function sliceByBlocks(
  sessionStart: Date,
  sessionEnd: Date,
  blockDefs: BlockDef[],
): { label: string; start: Date; end: Date; minutes: number; rate: number; lotMinutes: number }[] {
  const slices: { label: string; start: Date; end: Date; minutes: number; rate: number; lotMinutes: number }[] = [];

  let cursor = new Date(sessionStart);
  while (cursor < sessionEnd) {
    const curMod   = (cursor.getHours() * 60 + cursor.getMinutes()); // minute-of-day [0,1440)
    const curDay   = cursor.getDate();
    let   blockIdx = getBlockIndex(curMod, blockDefs);
    if (blockIdx < 0) {
      // uncovered range — skip it (it is handled elsewhere, e.g. car night-flat)
      const starts = blockDefs.map(b => b.startHour * 60).sort((a, b) => a - b);
      const cm = cursor.getHours() * 60 + cursor.getMinutes();
      let next = starts.find(s => s > cm);
      const d = new Date(cursor);
      if (next !== undefined) {
        d.setHours(Math.floor(next / 60), next % 60, 0, 0);
      } else {
        d.setHours(Math.floor(starts[0] / 60), starts[0] % 60, 0, 0);
        d.setDate(d.getDate() + 1);
      }
      cursor = d > sessionEnd ? sessionEnd : d;
      continue;
    }

    const block = blockDefs[blockIdx];

    // Determine the minute-of-day when this block ends
    let endOfBlockMinutes: number;
    if (block.startHour < block.endHour) {
      // Normal: block ends today
      endOfBlockMinutes = block.endHour * 60;
    } else {
      // Wrap-around: block ends next day at endHour
      endOfBlockMinutes = block.endHour * 60;
    }

    // Build a Date for the block end
    const blockEnd = new Date(cursor);
    blockEnd.setHours(Math.floor(endOfBlockMinutes / 60), endOfBlockMinutes % 60, 0, 0);
    // If block end is same date as cursor but not after cursor, it's next occurrence
    if (block.startHour > block.endHour && blockEnd.getDate() === curDay) {
      blockEnd.setDate(blockEnd.getDate() + 1);
    }

    const sliceEnd = blockEnd > sessionEnd ? sessionEnd : blockEnd;
    const sliceMinutes = Math.round((sliceEnd.getTime() - cursor.getTime()) / 60000);

    slices.push({
      label:    block.label,
      start:    new Date(cursor),
      end:      new Date(sliceEnd),
      minutes:  sliceMinutes,
      rate:     block.rate,
      lotMinutes: block.lotMinutes,
    });

    cursor = sliceEnd;
  }

  return slices;
}

// ─── Motorbike ──────────────────────────────────────────────────────────────

const MOTORBIKE_BLOCKS: BlockDef[] = [
  { label: 'Ban ngày (06:00–17:59)',  startHour:  6, endHour: 18, rate: 3000,  lotMinutes: 240 },
  { label: 'Ban đêm (18:00–05:59)',   startHour: 18, endHour:  6, rate: 4000,  lotMinutes: 240 },
];

export function calcMotorbikeFee(checkIn: Date, checkOut: Date): FeeResult {
  const slices = sliceByBlocks(checkIn, checkOut, MOTORBIKE_BLOCKS);
  const breakdown: FeeBlock[] = slices.map((s) => ({
    startTime:    s.start,
    endTime:      s.end,
    label:        s.label,
    minutesInBlock: s.minutes,
    rate:         s.rate,
    lotHours:     s.lotMinutes / 60,
    lots:         ceilLots(s.minutes, s.lotMinutes),
    amount:       ceilLots(s.minutes, s.lotMinutes) * s.rate,
  }));
  return { total: breakdown.reduce((sum, b) => sum + b.amount, 0), breakdown };
}

// ─── Car ───────────────────────────────────────────────────────────────────

const CAR_DAY_BLOCKS: BlockDef[] = [
  { label: 'Ban ngày (06:00–17:59)',  startHour:  6, endHour: 18, rate: 15000, lotMinutes: 120 },
  { label: 'Buổi tối (18:00–23:59)', startHour: 18, endHour: 24, rate: 20000, lotMinutes: 120 },
];

export function calcCarFee(checkIn: Date, checkOut: Date): FeeResult {
  const sessionStart = new Date(checkIn);
  const sessionEnd   = new Date(checkOut);

  // Night-flat: charge 100k flat if ANY part of the session falls in 00:00–05:59
  let nightMinutes = 0;
  let nightStart: Date | null = null;
  let nightEnd:   Date | null = null;

  // Walk through the night window only (00:00–06:00 each night)
  let nightCursor = new Date(sessionStart);
  nightCursor.setHours(0, 0, 0, 0);

  while (nightCursor < sessionEnd) {
    // Advance to next 00:00
    if (nightCursor.getHours() !== 0 || nightCursor.getMinutes() !== 0) {
      nightCursor.setHours(0, 0, 0, 0);
      nightCursor.setDate(nightCursor.getDate() + 1);
    }

    if (nightCursor >= sessionEnd) break;

    const nightBlockStart = new Date(nightCursor); // 00:00 today
    const nightBlockEnd   = new Date(nightCursor);
    nightBlockEnd.setHours(6, 0, 0, 0); // 06:00

    const overlapStart = nightBlockStart > sessionStart ? nightBlockStart : sessionStart;
    const overlapEnd   = nightBlockEnd   < sessionEnd   ? nightBlockEnd   : sessionEnd;

    if (overlapStart < overlapEnd) {
      const mins = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
      nightMinutes += mins;
      nightStart = nightStart ?? overlapStart;
      nightEnd   = overlapEnd;
    }

    nightCursor.setDate(nightCursor.getDate() + 1); // next night
  }

  const hasNightFlat = nightMinutes > 0;

  // Regular per-block slices for day + evening blocks
  const slices = sliceByBlocks(sessionStart, sessionEnd, CAR_DAY_BLOCKS);
  const breakdown: FeeBlock[] = slices.map((s) => ({
    startTime:      s.start,
    endTime:        s.end,
    label:          s.label,
    minutesInBlock: s.minutes,
    rate:           s.rate,
    lotHours:       s.lotMinutes / 60,
    lots:           ceilLots(s.minutes, s.lotMinutes),
    amount:         ceilLots(s.minutes, s.lotMinutes) * s.rate,
  }));

  // Insert night-flat block
  if (hasNightFlat && nightStart && nightEnd) {
    breakdown.push({
      startTime:    nightStart,
      endTime:      nightEnd,
      label:        'Đêm muộn (00:00–05:59)',
      minutesInBlock: nightMinutes,
      rate:         100000,
      lotHours:     0,
      lots:         1,
      amount:       100000,
      note:         'Phí cố định — tính trọn đêm',
    });
    breakdown.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  return { total: breakdown.reduce((sum, b) => sum + b.amount, 0), breakdown };
}

// ─── Unified dispatcher ──────────────────────────────────────────────────────

export function calcFee(
  checkIn: Date,
  checkOut: Date,
  vehicleType: 'CAR' | 'MOTORBIKE',
  isMonthly?: boolean,
): FeeResult {
  if (isMonthly) return { total: 0, breakdown: [] };
  return vehicleType === 'MOTORBIKE'
    ? calcMotorbikeFee(checkIn, checkOut)
    : calcCarFee(checkIn, checkOut);
}
