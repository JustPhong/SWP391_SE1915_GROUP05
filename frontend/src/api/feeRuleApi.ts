import api from '../services/api';

export interface FeeRule {
  id: number;
  vehicleType: string;
  ruleType: string;
  label: string;
  startHour: number;
  endHour: number;
  blockMinutes: number | null;
  amount: number;
  isActive: boolean;
}

function unwrap<T>(response: { data: { success: boolean; data: T; message?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'Lỗi không xác định');
  }
  return response.data.data;
}

export async function getFeeRules(): Promise<FeeRule[]> {
  return unwrap(await api.get<{ success: boolean; data: FeeRule[] }>('/admin/fee-rules'));
}

export async function updateFeeRuleAmount(id: number, amount: number): Promise<FeeRule> {
  return unwrap(
    await api.patch<{ success: boolean; data: FeeRule }>(`/admin/fee-rules/${id}`, { amount })
  );
}
