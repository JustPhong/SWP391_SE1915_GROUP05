import type { UserRole } from '../types';

export function getRoleHomePath(role: UserRole): string {
  if (role === 'ADMIN') return '/admin/users';
  if (role === 'MANAGER') return '/manager/dashboard';
  if (role === 'STAFF') return '/staff/dashboard';
  return '/dashboard';
}
