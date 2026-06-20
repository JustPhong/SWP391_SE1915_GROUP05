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

  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { vehicleType, ruleType, label, startHour, endHour, blockMinutes, amount } = req.body;

    if (!['MOTORBIKE', 'CAR'].includes(vehicleType))
      return res.status(400).json({ success: false, message: 'vehicleType không hợp lệ' });
    if (!['TIME_BLOCK', 'FLAT_OVERNIGHT'].includes(ruleType))
      return res.status(400).json({ success: false, message: 'ruleType không hợp lệ' });
    if (!label?.trim())
      return res.status(400).json({ success: false, message: 'label không được để trống' });
    if (typeof amount !== 'number' || amount < 0)
      return res.status(400).json({ success: false, message: 'amount phải là số không âm' });

    const rule = await feeRuleService.createRule({
      vehicleType, ruleType, label: label.trim(),
      startHour: Number(startHour), endHour: Number(endHour),
      blockMinutes: blockMinutes ? Number(blockMinutes) : undefined,
      amount,
    });

    const actor = await extractActor(req);
    await writeAuditLog({
      ...actor,
      action: 'fee_rule.create',
      targetType: 'FeeRule',
      targetId: String(rule.id),
      description: `Tạo quy tắc phí: ${rule.label}`,
      metadata: { label: rule.label, vehicleType: rule.vehicleType, ruleType: rule.ruleType, amount: Number(rule.amount) },
    });

    return res.status(201).json({ success: true, data: rule });
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params['id'] ?? '0', 10);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'id không hợp lệ' });

    const before = await prisma.feeRule.findUnique({ where: { id } });
    const updated = await feeRuleService.updateRule(id, req.body);

    const actor = await extractActor(req);
    await writeAuditLog({
      ...actor,
      action: 'fee_rule.update',
      targetType: 'FeeRule',
      targetId: String(id),
      description: `Cập nhật quy tắc phí: ${updated.label}`,
      metadata: { before, after: updated },
    });

    return res.status(200).json({ success: true, data: updated });
  }),

  toggleActive: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params['id'] ?? '0', 10);
    const { isActive } = req.body as { isActive: boolean };
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'id không hợp lệ' });

    const updated = await feeRuleService.toggleActive(id, isActive);

    const actor = await extractActor(req);
    await writeAuditLog({
      ...actor,
      action: isActive ? 'fee_rule.enable' : 'fee_rule.disable',
      targetType: 'FeeRule',
      targetId: String(id),
      description: `${isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} quy tắc phí: ${updated.label}`,
      metadata: { label: updated.label, isActive },
    });

    return res.status(200).json({ success: true, data: updated });
  }),

  remove: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params['id'] ?? '0', 10);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'id không hợp lệ' });

    const before = await prisma.feeRule.findUnique({ where: { id } });
    await feeRuleService.deleteRule(id);

    const actor = await extractActor(req);
    await writeAuditLog({
      ...actor,
      action: 'fee_rule.delete',
      targetType: 'FeeRule',
      targetId: String(id),
      description: `Xóa quy tắc phí: ${before?.label}`,
      metadata: { label: before?.label, vehicleType: before?.vehicleType },
    });

    return res.status(200).json({ success: true, message: 'Xóa quy tắc phí thành công' });
  }),
};
