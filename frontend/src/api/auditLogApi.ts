import api from '../services/api';

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  description: string;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogList {
  rows: AuditLogItem[];
  total: number;
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Lỗi không xác định');
  }
  return response.data.data;
}

export async function getAuditLogs(skip: number, take: number): Promise<AuditLogList> {
  return unwrap(
    await api.get<{ success: boolean; data: AuditLogList }>('/admin/audit-logs', {
      params: { skip, take },
    })
  );
}
