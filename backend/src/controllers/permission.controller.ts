import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { AppError } from '../utils/helpers';

const SYSTEM_ROLES = ['DRIVER', 'STAFF', 'MANAGER', 'ADMIN'] as const;

export const permissionController = {
  // GET /api/admin/permissions
  getAll: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [permissions, roles] = await Promise.all([
      prisma.permission.findMany({ orderBy: { category: 'asc' } }),
      prisma.role.findMany({ include: { rolePermissions: true } }),
    ]);

    // Build matrix keyed by role NAME (frontend expects string keys)
    const roleMatrix: Record<string, Record<string, boolean>> = {};
    for (const r of roles) {
      roleMatrix[r.name] = {};
      for (const rp of r.rolePermissions) {
        roleMatrix[r.name][rp.permissionKey] = rp.allowed;
      }
    }

    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }

    return res.status(200).json({
      success: true,
      data: {
        permissions: grouped,
        roles: SYSTEM_ROLES,
        roleMatrix,
      },
    });
  }),

  // PATCH /api/admin/permissions
  toggle: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { role, permissionKey, allowed } = req.body as {
      role: string;
      permissionKey: string;
      allowed: boolean;
    };

    if (!role || !permissionKey || allowed === undefined) {
      throw new AppError(400, 'Thiếu thông tin phân quyền');
    }

    if (!SYSTEM_ROLES.includes(role as typeof SYSTEM_ROLES[number])) {
      throw new AppError(400, 'Vai trò không hợp lệ');
    }

    const perm = await prisma.permission.findUnique({ where: { key: permissionKey } });
    if (!perm) throw new AppError(400, 'Quyền không tồn tại');

    if (role === 'ADMIN' && ['account.manage', 'permission.manage'].includes(permissionKey)) {
      throw new AppError(400, 'Không thể tắt quyền quản trị cốt lõi của Admin — tránh tự khóa hệ thống');
    }

    const roleRow = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRow) throw new AppError(400, 'Vai trò không tồn tại');

    const updated = await prisma.rolePermission.upsert({
      where: { roleId_permissionKey: { roleId: roleRow.id, permissionKey } },
      update: { allowed },
      create: { permissionKey, allowed, roleId: roleRow.id },
    });

    return res.status(200).json({ success: true, data: updated });
  }),
};
