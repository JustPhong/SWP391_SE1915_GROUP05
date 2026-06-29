import api from '../services/api';
import type { User } from '../types';

export interface UpdateProfileInput {
  fullName?: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const response = await api.patch<{ success: boolean; data: User }>('/auth/profile', input);
  if (!response.data.success) {
    throw new Error('Cập nhật thông tin cá nhân thất bại');
  }
  return response.data.data;
}

export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  const response = await api.patch<{ success: boolean; message?: string }>('/auth/password', input);
  if (!response.data.success) {
    throw new Error('Đổi mật khẩu thất bại');
  }
}
