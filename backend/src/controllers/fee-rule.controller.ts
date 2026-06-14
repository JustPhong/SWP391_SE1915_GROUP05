import { Response } from 'express';
import { feeRuleService } from '../services/feeRule.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

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
    const updated = await feeRuleService.updateRuleAmount(id, amount);
    return res.status(200).json({ success: true, data: updated });
  }),
};
