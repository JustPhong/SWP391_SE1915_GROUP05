import { Response } from 'express';
import { listLogs } from '../services/auditLog.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const auditLogController = {
  // GET /api/admin/audit-logs?skip=&take=
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const skip = Math.max(0, parseInt((req.query.skip as string) ?? '0', 10) || 0);
    const takeRaw = parseInt((req.query.take as string) ?? '20', 10) || 20;
    const take = Math.min(100, Math.max(1, takeRaw));

    const { rows, total } = await listLogs({ skip, take });
    return res.status(200).json({ success: true, data: { rows, total } });
  }),
};
