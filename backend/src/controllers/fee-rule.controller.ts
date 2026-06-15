import { Response } from 'express';
import { feeRuleService } from '../services/feeRule.service';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { writeAuditLog, extractActor } from '../services/auditLog.service';

export const feeRuleController = {
  list: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const rules = await feeRuleService.listRules();
    return res.status(200).json({ success: true, data: rules });
  }),

  updateAmount: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params['id'] ?? '0', 10);
    const { amount } = req.body as { amount: number };
    if (!id || isNaN(id)) throw new Error('Invalid id');
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ success: false, message: 'amount phải là số không âm.' });
    }

    // Snapshot the previous value before the service mutates the row, so
    // we can record a meaningful old/new in the audit metadata.
    const before = await prisma.feeRule.findUnique({ where: { id } });
    const oldAmount = before ? Number(before.amount) : null;

    const updated = await feeRuleService.updateRuleAmount(id, amount);

    const actor = await extractActor(req);
    const newAmount = Number(updated.amount);
    await writeAuditLog({
      ...actor,
      action: 'fee_rule.update',
      targetType: 'FeeRule',
      targetId: String(updated.id),
      description: `Đổi giá ${updated.label} từ ${oldAmount ?? '?'}đ thành ${newAmount}đ`,
      metadata: {
        feeRuleId: updated.id,
        label: updated.label,
        vehicleType: updated.vehicleType,
        ruleType: updated.ruleType,
        old: oldAmount,
        new: newAmount,
      },
    });

    return res.status(200).json({ success: true, data: updated });
  }),
};
