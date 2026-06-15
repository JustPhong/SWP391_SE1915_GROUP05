import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { DEFAULT_FEE_CONFIG, FeeConfig, BlockDef } from '../utils/fee';
import type { Prisma } from '@prisma/client';

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  config: FeeConfig;
  expiresAt: number;
}

let configCache: CacheEntry | null = null;

function buildConfigFromRows(
  rows: Array<{
    vehicleType: string;
    ruleType: string;
    label: string;
    startHour: number;
    endHour: number;
    blockMinutes: number | null;
    amount: Prisma.Decimal | number;
  }>,
): FeeConfig {
  const motorbikeBlocks: BlockDef[] = [];
  const carDayBlocks: BlockDef[] = [];
  let carNightFlat = DEFAULT_FEE_CONFIG.carNightFlat;

  for (const r of rows) {
    const blockDef: BlockDef = {
      label:        r.label,
      startHour:    r.startHour,
      endHour:      r.endHour,
      rate:         Number(r.amount),
      lotMinutes:   r.blockMinutes ?? 0,
    };

    if (r.vehicleType === 'MOTORBIKE' && r.ruleType === 'TIME_BLOCK') {
      motorbikeBlocks.push(blockDef);
    } else if (r.vehicleType === 'CAR' && r.ruleType === 'TIME_BLOCK') {
      carDayBlocks.push(blockDef);
    } else if (r.vehicleType === 'CAR' && r.ruleType === 'FLAT_OVERNIGHT') {
      carNightFlat = Number(r.amount);
    }
  }

  // Sort by startHour so block evaluation order is stable
  motorbikeBlocks.sort((a, b) => a.startHour - b.startHour);
  carDayBlocks.sort((a, b) => a.startHour - b.startHour);

  return { motorbikeBlocks, carDayBlocks, carNightFlat };
}

function invalidateCache() {
  configCache = null;
}

function isCacheValid(): boolean {
  return configCache !== null && Date.now() < configCache.expiresAt;
}

export const feeRuleService = {
  /**
   * Returns the mapped FeeConfig, using a 60-second in-memory cache.
   * Falls back to DEFAULT_FEE_CONFIG if the table is empty or query fails.
   */
  async getFeeConfig(): Promise<FeeConfig> {
    if (isCacheValid()) {
      return configCache!.config;
    }

    try {
      const rows = await prisma.feeRule.findMany({
        where: { isActive: true },
        orderBy: [{ vehicleType: 'asc' }, { startHour: 'asc' }],
      });

      if (rows.length === 0) {
        // No rules seeded yet — use defaults
        configCache = { config: DEFAULT_FEE_CONFIG, expiresAt: Date.now() + CACHE_TTL_MS };
        return DEFAULT_FEE_CONFIG;
      }

      const config = buildConfigFromRows(rows);
      configCache = { config, expiresAt: Date.now() + CACHE_TTL_MS };
      return config;
    } catch {
      return DEFAULT_FEE_CONFIG;
    }
  },

  /**
   * Invalidate the cache — call after any write operation.
   */
  invalidateCache,

  /**
   * List all fee rules for the admin UI.
   */
  async listRules() {
    return prisma.feeRule.findMany({
      orderBy: [{ vehicleType: 'asc' }, { startHour: 'asc' }],
    });
  },

  /**
   * Update ONLY the amount of a rule. Invalidates the cache.
   */
  async updateRuleAmount(id: number, amount: number) {
    const existing = await prisma.feeRule.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Quy tắc phí không tồn tại.');

    const updated = await prisma.feeRule.update({
      where: { id },
      data: { amount },
    });

    invalidateCache();
    return updated;
  },
};
