import api from '../services/api';

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: 'DRIVER' | 'STAFF' | 'MANAGER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  role: 'DRIVER' | 'STAFF' | 'MANAGER' | 'ADMIN';
  password: string;
}

export interface UpdateUserInput {
  fullName?: string;
  role?: 'DRIVER' | 'STAFF' | 'MANAGER' | 'ADMIN';
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Lỗi không xác định');
  }
  return response.data.data;
}

export async function getUsers(params?: {
  role?: string;
  search?: string;
}): Promise<UserItem[]> {
  return unwrap(
    await api.get<{ success: boolean; data: UserItem[] }>('/admin/users', { params })
  );
}

export async function createUser(input: CreateUserInput): Promise<UserItem> {
  return unwrap(
    await api.post<{ success: boolean; data: UserItem }>('/admin/users', input)
  );
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserItem> {
  return unwrap(
    await api.patch<{ success: boolean; data: UserItem }>(`/admin/users/${id}`, input)
  );
}

export async function toggleUserStatus(id: string, isActive: boolean): Promise<UserItem> {
  return unwrap(
    await api.patch<{ success: boolean; data: UserItem }>(`/admin/users/${id}/status`, { isActive })
  );
}

export async function resetUserPassword(id: string): Promise<{ tempPassword: string }> {
  return unwrap(
    await api.post<{ success: boolean; data: { tempPassword: string } }>(
      `/admin/users/${id}/reset-password`
    )
  );
}
