import prisma from '../config/db';

const SLOT_AVAILABLE = 'AVAILABLE';

export interface SlotSuggestion {
  slotId: string;
  code: string;
  floorId: number;
  floorCode: string;
  type: string;
  score: number;
  reason: string[];
}

export type ZoneType = 'MONTHLY' | 'CASUAL';

// ── Greedy scoring weights ────────────────────────────────
const W = {
  VEHICLE_TYPE_MATCH:  100,  // loại xe khớp (CAR/MOTORBIKE)
  ZONE_MATCH:           50,  // tầng đúng loại khách (CASUAL/MONTHLY)
  NOT_FIXED:            30,  // slot không bị lock cho gói tháng
  FLOOR_PROXIMITY:      20,  // tầng thấp hơn → gần lối vào hơn
  SLOT_PROXIMITY:       10,  // số slot nhỏ hơn → gần đầu dãy hơn
} as const;

// ── Parse số thứ tự từ slot code (vd: "G-03" → 3, "3-12" → 12) ──
function parseSlotNumber(code: string): number {
  const match = code.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 999;
}

// ── Tính điểm Greedy cho 1 slot ──────────────────────────
function scoreSlot(
  slot: {
    id: string;
    code: string;
    floorId: number;
    type: string;
    isFixed: boolean;
    floor: { floorCode: string; vehicleType: string; customerType: string };
  },
  vehicleType: string,
  zone: ZoneType,
  maxFloorId: number,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Loại xe khớp
  if (slot.type.toUpperCase() === vehicleType.toUpperCase()) {
    score += W.VEHICLE_TYPE_MATCH;
    reasons.push('Đúng loại xe');
  }

  // 2. Tầng đúng loại khách
  if (slot.floor.customerType === zone) {
    score += W.ZONE_MATCH;
    reasons.push(`Đúng khu ${zone === 'CASUAL' ? 'vãng lai' : 'gói tháng'}`);
  }

  // 3. Slot không bị khóa cho gói tháng
  if (!slot.isFixed) {
    score += W.NOT_FIXED;
    reasons.push('Slot tự do');
  }

  // 4. Ưu tiên tầng thấp (gần lối vào) — normalize 0..20
  const floorScore = maxFloorId > 1
    ? Math.round(W.FLOOR_PROXIMITY * (1 - (slot.floorId - 1) / (maxFloorId - 1)))
    : W.FLOOR_PROXIMITY;
  score += floorScore;

  // 5. Ưu tiên số slot nhỏ (gần đầu dãy) — normalize 0..10
  const slotNum = parseSlotNumber(slot.code);
  const slotScore = slotNum <= 10
    ? W.SLOT_PROXIMITY
    : slotNum <= 20
    ? Math.round(W.SLOT_PROXIMITY * 0.6)
    : Math.round(W.SLOT_PROXIMITY * 0.2);
  score += slotScore;

  return { score, reasons };
}

// ════════════════════════════════════════════════════════
export const slotSuggestionService = {

  // ── Greedy: gợi ý 1 slot tốt nhất ───────────────────
  async suggestSlot(vehicleType: string, zone: ZoneType): Promise<SlotSuggestion | null> {
    const slots = await prisma.parkingSlot.findMany({
      where: {
        status: SLOT_AVAILABLE,
        type: vehicleType.toUpperCase(),
        isFixed: zone === 'CASUAL' ? false : undefined,
        assignedVehicleId: zone === 'CASUAL' ? null : undefined,
      },
      include: {
        floor: {
          select: { floorCode: true, vehicleType: true, customerType: true },
        },
      },
    });

    if (slots.length === 0) return null;

    const maxFloorId = Math.max(...slots.map((s) => s.floorId));

    // Score tất cả slot rồi chọn điểm cao nhất
    let best: (typeof slots)[0] | null = null;
    let bestScore = -1;
    let bestReasons: string[] = [];

    for (const slot of slots) {
      const { score, reasons } = scoreSlot(slot, vehicleType, zone, maxFloorId);
      if (score > bestScore) {
        bestScore = score;
        best = slot;
        bestReasons = reasons;
      }
    }

    if (!best) return null;

    return {
      slotId:    best.id,
      code:      best.code,
      floorId:   best.floorId,
      floorCode: best.floor.floorCode,
      type:      best.type,
      score:     bestScore,
      reason:    bestReasons,
    };
  },

  // ── Greedy: top N slot gợi ý (cho FE hiển thị danh sách) ──
  async suggestTopSlots(
    vehicleType: string,
    zone: ZoneType,
    topN = 3,
  ): Promise<SlotSuggestion[]> {
    const slots = await prisma.parkingSlot.findMany({
      where: {
        status: SLOT_AVAILABLE,
        type: vehicleType.toUpperCase(),
        isFixed: zone === 'CASUAL' ? false : undefined,
        assignedVehicleId: zone === 'CASUAL' ? null : undefined,
      },
      include: {
        floor: {
          select: { floorCode: true, vehicleType: true, customerType: true },
        },
      },
    });

    if (slots.length === 0) return [];

    const maxFloorId = Math.max(...slots.map((s) => s.floorId));

    const scored = slots.map((slot) => {
      const { score, reasons } = scoreSlot(slot, vehicleType, zone, maxFloorId);
      return {
        slotId:    slot.id,
        code:      slot.code,
        floorId:   slot.floorId,
        floorCode: slot.floor.floorCode,
        type:      slot.type,
        score,
        reason: reasons,
      };
    });

    // Sắp xếp giảm dần theo điểm, lấy top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  },

  // ── Lấy tất cả slot trống theo loại xe ──────────────
  async getAvailableSlots(vehicleType: string) {
    return prisma.parkingSlot.findMany({
      where: { status: SLOT_AVAILABLE, type: vehicleType.toUpperCase() },
      include: {
        floor: { select: { floorCode: true, vehicleType: true, customerType: true } },
      },
      orderBy: [{ floorId: 'asc' }, { code: 'asc' }],
    });
  },

  // ── Slot groupby floor (dùng cho sơ đồ bãi) ─────────
  async getAllSlotsGroupedByFloor() {
    const slots = await prisma.parkingSlot.findMany({
      orderBy: [{ floorId: 'asc' }, { code: 'asc' }],
    });

    const grouped: Record<number, typeof slots> = {};
    for (const slot of slots) {
      if (!grouped[slot.floorId]) grouped[slot.floorId] = [];
      grouped[slot.floorId].push(slot);
    }
    return grouped;
  },
};