import { Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { AppError } from '../utils/helpers';
import { writeAuditLog, extractActor } from '../services/auditLog.service';

const WALKIN_EMAIL = 'walkin@system.local';

const SYSTEM_ROLES = ['DRIVER', 'STAFF', 'MANAGER', 'ADMIN'] as const;
type SystemRole = typeof SYSTEM_ROLES[number];

function isSystemRole(r: string): r is SystemRole {
  return SYSTEM_ROLES.includes(r as SystemRole);
}

export const adminUserController = {
  // GET /api/admin/users
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { role, search } = req.query as { role?: string; search?: string };

    const where: any = {
      email: { not: WALKIN_EMAIL },
    };

    if (role && isSystemRole(role)) {
      where.roleRef = { name: role };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { fullName: { contains: term } },
        { email:    { contains: term } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id:        true,
        fullName:  true,
        email:     true,
        roleRef:   { select: { name: true } },
        isActive:  true,
        createdAt: true,
      },
    });

    const data = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.roleRef?.name ?? 'DRIVER',
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));

    return res.status(200).json({ success: true, data });
  }),

  // POST /api/admin/users
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fullName, email, role: roleName, password } = req.body as {
      fullName: string; email: string; role: string; password: string;
    };

    if (!fullName?.trim()) throw new AppError(400, 'Họ tên không được để trống');
    if (!email?.trim())    throw new AppError(400, 'Email không được để trống');
    if (!password?.trim()) throw new AppError(400, 'Mật khẩu không được để trống');
    if (!isSystemRole(roleName)) throw new AppError(400, 'Vai trò không hợp lệ');
    if (email === WALKIN_EMAIL) throw new AppError(400, 'Không thể tạo tài khoản hệ thống');

    const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existing) throw new AppError(409, 'Email đã được sử dụng');

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new AppError(400, 'Vai trò không hợp lệ');

    const passwordHash = await bcrypt.hash(password.trim(), 12);

    const user = await prisma.user.create({
      data: {
        fullName:     fullName.trim(),
        email:        email.trim().toLowerCase(),
        passwordHash,
        roleId:       role.id,
        isActive:    true,
      },
      select: {
        id: true, fullName: true, email: true,
        roleRef: { select: { name: true } },
        isActive: true, createdAt: true,
      },
    });

    const actor = await extractActor(req);
    await writeAuditLog({
      ...actor,
      action: 'account.create',
      targetType: 'User',
      targetId: user.id,
      description: `Tạo tài khoản ${user.email}`,
      metadata: { email: user.email, role: user.roleRef?.name ?? roleName, fullName: user.fullName },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: user.id, fullName: user.fullName, email: user.email,
        role: user.roleRef?.name ?? 'DRIVER', isActive: user.isActive, createdAt: user.createdAt,
      },
    });
  }),

  // PATCH /api/admin/users/:id
  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { fullName, role: roleName } = req.body as { fullName?: string; role?: string };

    const target = await prisma.user.findUnique({
      where: { id },
      include: { roleRef: true },
    });
    if (!target) throw new AppError(404, 'Không tìm thấy tài khoản');
    if (target.email === WALKIN_EMAIL) throw new AppError(400, 'Không thể chỉnh sửa tài khoản hệ thống');

    const data: any = {};
    if (fullName !== undefined) {
      if (!fullName.trim()) throw new AppError(400, 'Họ tên không được để trống');
      data.fullName = fullName.trim();
    }
    if (roleName !== undefined) {
      if (!isSystemRole(roleName)) throw new AppError(400, 'Vai trò không hợp lệ');
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) throw new AppError(400, 'Vai trò không hợp lệ');
      data.roleId = role.id;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, fullName: true, email: true,
                roleRef: { select: { name: true } },
                isActive: true, createdAt: true },
    });

    if (roleName !== undefined && target.roleRef?.name !== roleName) {
      const actor = await extractActor(req);
      await writeAuditLog({
        ...actor,
        action: 'account.role_change',
        targetType: 'User',
        targetId: updated.id,
        description: `Đổi vai trò ${updated.email} thành ${roleName}`,
        metadata: { email: updated.email, from: target.roleRef?.name ?? null, to: roleName },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: updated.id, fullName: updated.fullName, email: updated.email,
        role: updated.roleRef?.name ?? 'DRIVER', isActive: updated.isActive, createdAt: updated.createdAt,
      },
    });
  }),

  // PATCH /api/admin/users/:id/status
  toggleStatus: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    const target = await prisma.user.findUnique({
      where: { id },
      include: { roleRef: true },
    });
    if (!target) throw new AppError(404, 'Không tìm thấy tài khoản');
    if (target.email === WALKIN_EMAIL) throw new AppError(400, 'Không thể thay đổi trạng thái tài khoản hệ thống');
    if (target.id === req.user!.id) throw new AppError(400, 'Không thể tự khóa tài khoản của chính mình');

    if (isActive === false) {
      const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
      const activeAdminCount = await prisma.user.count({
        where: { roleId: adminRole!.id, isActive: true },
      });
      if (activeAdminCount <= 1 && target.roleRef!.name === 'ADMIN') {
        throw new AppError(400, 'Không thể khóa Admin hoạt động cuối cùng của hệ thống');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, fullName: true, email: true,
                roleRef: { select: { name: true } },
                isActive: true, createdAt: true },
    });

    const actor = await extractActor(req);
    await writeAuditLog({
      ...actor,
      action: isActive ? 'account.unlock' : 'account.lock',
      targetType: 'User',
      targetId: updated.id,
      description: isActive
        ? `Mở khoá tài khoản ${updated.email}`
        : `Khoá tài khoản ${updated.email}`,
      metadata: { email: updated.email, isActive },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: updated.id, fullName: updated.fullName, email: updated.email,
        role: updated.roleRef?.name ?? 'DRIVER', isActive: updated.isActive, createdAt: updated.createdAt,
      },
    });
  }),

  // POST /api/admin/users/:id/reset-password
  resetPassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new AppError(404, 'Không tìm thấy tài khoản');
    if (target.email === WALKIN_EMAIL) throw new AppError(400, 'Không thể đặt lại mật khẩu tài khoản hệ thống');

    const tempPassword = Math.random().toString(36).slice(-8) + Math.floor(1000 + Math.random() * 9000);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    const actor = await extractActor(req);
    await writeAuditLog({
      ...actor,
      action: 'account.password_reset',
      targetType: 'User',
      targetId: target.id,
      description: `Đặt lại mật khẩu ${target.email}`,
      metadata: { email: target.email },
    });

    return res.status(200).json({
      success: true,
      data: { tempPassword },
    });
  }),
};