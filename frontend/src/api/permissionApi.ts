import api from '../services/api';

export interface PermissionItem {
  id: string;
  key: string;
  label: string;
  category: string;
}

export interface PermissionMatrix {
  permissions: Record<string, PermissionItem[]>;
  roles: string[];
  roleMatrix: Record<string, Record<string, boolean>>;
}

function unwrap<T>(response: { data: { success: boolean; data: T } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Lỗi không xác định');
  }
  return response.data.data;
}

export async function getPermissions(): Promise<PermissionMatrix> {
  return unwrap(
    await api.get<{ success: boolean; data: PermissionMatrix }>('/admin/permissions')
  );
}

export async function togglePermission(params: {
  role: string;
  permissionKey: string;
  allowed: boolean;
}): Promise<void> {
  const res = await api.patch<{ success: boolean }>('/admin/permissions', params);
  if (!res.data.success) {
    throw new Error(res.data.message ?? 'Lỗi không xác định');
  }
}
