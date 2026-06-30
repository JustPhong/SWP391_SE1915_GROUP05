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

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await api.post<{ success: boolean; data: User }>('/auth/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!response.data.success) {
    throw new Error('Tải ảnh lên thất bại');
  }
  return response.data.data;
}

export async function removeAvatar(): Promise<User> {
  const response = await api.delete<{ success: boolean; data: User }>('/auth/avatar');
  if (!response.data.success) {
    throw new Error('Xoá ảnh thất bại');
  }
  return response.data.data;
}

export async function deleteAccount(password: string): Promise<void> {
  const response = await api.delete<{ success: boolean; message?: string }>('/auth/profile', {
    data: { password }
  });
  if (!response.data.success) {
    throw new Error(response.data.message || 'Xóa tài khoản thất bại');
  }
}
