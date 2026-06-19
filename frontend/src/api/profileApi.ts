import api from '../services/api';
import type { User } from '../types';

export interface UpdateProfileInput {
  fullName?: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const response = await api.patch<{ success: boolean; data: User }>('/auth/profile', input);
  if (!response.data.success) {
    throw new Error('Cập nhật thông tin cá nhân thất bại');
  }
  return response.data.data;
}
