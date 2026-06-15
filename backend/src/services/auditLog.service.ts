import { Request } from 'express';
import prisma from '../config/db';

export interface WriteAuditLogParams {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Append a single AuditLog row.
 *
 * CRITICAL: This call MUST NEVER break the surrounding business action.
 * Any error from the database write is caught, logged to stderr, and swallowed.
 * The audit log is secondary telemetry — if it fails, the primary mutation
 * (e.g. locking a user) must still succeed.
 */
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId:    params.actorId ?? null,
        actorName:  params.actorName ?? null,
        actorRole:  params.actorRole ?? null,
        action:     params.action,
        targetType: params.targetType ?? null,
        targetId:   params.targetId ?? null,
        description: params.description,
        metadata:   params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress:  params.ipAddress ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[AuditLog] failed to write log:', err);
  }
}

export interface ActorSnapshot {
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  ipAddress: string | null;
}

/**
 * Extract actor identity (id/name/role) and client IP from an Express request,
 * using whatever the auth middleware already populated on req.user.
 *
 * If the request was made by a logged-in user, we look up their current
 * fullName from the DB so the snapshot reflects reality, but fall back to
 * the token's email if the user no longer exists.
 */
export async function extractActor(req: Request): Promise<ActorSnapshot> {
  const user = (req as any).user as { id: string; email: string; role: string } | undefined;

  const forwarded = req.headers['x-forwarded-for'];
  let ip: string | null = null;
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    ip = forwarded.split(',')[0]!.trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    ip = forwarded[0]!;
  } else {
    ip = req.ip ?? null;
  }

  if (!user) {
    return { actorId: null, actorName: null, actorRole: null, ipAddress: ip };
  }

  let actorName: string | null = user.email;
  try {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true },
    });
    if (row?.fullName) actorName = row.fullName;
  } catch {
    // Keep the fallback (email) on lookup failure.
  }

  return {
    actorId:    user.id,
    actorName,
    actorRole:  user.role,
    ipAddress:  ip,
  };
}

export interface ListLogsParams {
  skip: number;
  take: number;
}

/**
 * Read-only paginated listing, newest first. No filters at Bước 1.
 */
export async function listLogs({ skip, take }: ListLogsParams) {
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.auditLog.count(),
  ]);
  return { rows, total };
}
