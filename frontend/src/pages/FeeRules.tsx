import { useState, useEffect } from 'react';
import { getFeeRules, FeeRule, getBookingConfig, updateBookingConfig, BookingConfig } from '../api/feeRuleApi';

const C = {
  navy: '#1E3A5F',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  greenBorder: '#86EFAC',
  red: '#DC2626',
  redBg: '#FEE2E2',
  redBorder: '#FECACA',
  gray50: '#F9FAFB',
  gray100: '#F3F5F7',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#5C6B7A',
  gray800: '#111827',
  shadow: '0 8px 32px rgba(30,58,95,0.08)',
  radius: 18,
};

function formatTimeWindow(startHour: number, endHour: number, ruleType: string) {
  if (ruleType === 'FLAT_OVERNIGHT') return `${String(startHour).padStart(2, '0')}:00–${String(endHour).padStart(2, '0')}:59`;
  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return `${fmt(startHour)}–${endHour === 24 ? '23:59' : fmt(endHour) + ':59'}`;
}

export function FeeRulesPage() {
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [bookingConfig, setBookingConfig] = useState<BookingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [rulesData, configData] = await Promise.all([
        getFeeRules(),
        getBookingConfig(),
      ]);
      setRules(rulesData);
      setBookingConfig(configData);
    } catch {
      setError('Không thể tải quy tắc phí hoặc cấu hình đặt chỗ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const motorbikeRules = rules.filter(r => r.vehicleType === 'MOTORBIKE');
  const carRules = rules.filter(r => r.vehicleType === 'CAR');

  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: C.navy }}>
          Quy tắc tính phí
        </h1>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: C.gray500 }}>
          Cấu hình giá vé theo loại xe và khung giờ
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 8, padding: '0.6rem 0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: C.red }}>{error}</span>
        </div>
      )}

      {loading ? (
        <p style={{ color: C.gray400 }}>Đang tải...</p>
      ) : (
        <>
          {/* Motorbike section */}
          <Section title="Xe máy" color={C.gray800} rules={motorbikeRules} />

          {/* Car section */}
          <Section title="Ô tô" color={C.gray800} rules={carRules} />

          {/* Booking section */}
          <BookingConfigSection
            config={bookingConfig}
            onSaveSuccess={(updated) => setBookingConfig(updated)}
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  color,
  rules,
}: {
  title: string;
  color: string;
  rules: FeeRule[];
}) {
  const C2 = {
    navy: '#1E3A5F',
    white: '#FFFFFF',
    green: '#16A34A',
    greenBg: '#DCFCE7',
    greenBorder: '#86EFAC',
    red: '#DC2626',
    redBg: '#FEE2E2',
    redBorder: '#FECACA',
    gray50: '#F9FAFB',
    gray100: '#F3F5F7',
    gray200: '#E5E7EB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#5C6B7A',
    gray800: '#111827',
    shadow: '0 8px 32px rgba(30,58,95,0.08)',
    radius: 18,
  };

  return (
    <div style={{ background: C2.white, borderRadius: C2.radius, boxShadow: C2.shadow, marginBottom: '1.25rem', overflow: 'hidden' }}>
      <div style={{ padding: '0.85rem 1.25rem', background: C2.gray50, borderBottom: `2px solid ${C2.gray200}` }}>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: color }}>{title}</p>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C2.gray200}`, background: C2.gray100 }}>
            {['Khung giờ', 'Quy tắc', 'Đơn vị tính', 'Đơn giá (VND)', ''].map(h => (
              <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C2.gray400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const C3 = {
  navy: '#1E3A5F',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  greenBorder: '#86EFAC',
  red: '#DC2626',
  redBg: '#FEE2E2',
  redBorder: '#FECACA',
  gray50: '#F9FAFB',
  gray100: '#F3F5F7',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#5C6B7A',
  gray800: '#111827',
  shadow: '0 8px 32px rgba(30,58,95,0.08)',
  radius: 18,
};

function RuleRow({ rule }: { rule: FeeRule }) {
  const [localVal, setLocalVal] = useState(String(rule.amount));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  useEffect(() => { setLocalVal(String(rule.amount)); }, [rule.amount]);

  const handleSave = async () => {
    const val = parseInt(localVal, 10);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    setStatus('idle');
    try {
      const { updateFeeRuleAmount } = await import('../api/feeRuleApi');
      await updateFeeRuleAmount(rule.id, val);
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('err');
    } finally {
      setSaving(false);
    }
  };

  const lotLabel = rule.blockMinutes
    ? `${rule.blockMinutes / 60}h`
    : 'Trọn đêm';

  return (
    <tr style={{ borderBottom: `1px solid ${C3.gray100}` }}>
      <td style={{ padding: '0.75rem 1rem' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C3.gray800 }}>{rule.label}</span>
        <span style={{ display: 'block', fontSize: '0.72rem', color: C3.gray400 }}>
          {formatTimeWindow(rule.startHour, rule.endHour, rule.ruleType)}
        </span>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.15rem 0.5rem',
          borderRadius: 20,
          background: rule.ruleType === 'FLAT_OVERNIGHT' ? '#FEF9C3' : '#EFF6FF',
          color: rule.ruleType === 'FLAT_OVERNIGHT' ? '#854D0E' : C3.navy,
        }}>
          {rule.ruleType === 'FLAT_OVERNIGHT' ? 'Phí trọn đêm' : 'Theo lô'}
        </span>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <span style={{ fontSize: '0.82rem', color: C3.gray600 }}>{lotLabel}</span>
      </td>
      <td style={{ padding: '0.75rem 1rem', minWidth: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input
            type="number"
            value={localVal}
            onChange={e => setLocalVal(e.target.value)}
            style={{
              width: 110,
              padding: '0.35rem 0.5rem',
              border: `1.5px solid ${status === 'err' ? C3.redBorder : C3.gray200}`,
              borderRadius: 6,
              fontSize: '0.82rem',
              color: C3.gray800,
              background: C3.white,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving || localVal === String(rule.amount)}
            style={{
              padding: '0.35rem 0.75rem',
              background: saving || localVal === String(rule.amount) ? C3.gray200 : C3.navy,
              color: saving || localVal === String(rule.amount) ? C3.gray400 : C3.white,
              border: 'none',
              borderRadius: 6,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: saving || localVal === String(rule.amount) ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {saving ? '...' : status === 'ok' ? '✓' : 'Lưu'}
          </button>
        </div>
      </td>
    </tr>
  );
}

function BookingConfigSection({
  config,
  onSaveSuccess,
}: {
  config: BookingConfig | null;
  onSaveSuccess: (updated: BookingConfig) => void;
}) {
  const [localVal, setLocalVal] = useState(config ? String(config.depositAmount) : '15000');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (config) {
      setLocalVal(String(config.depositAmount));
    }
  }, [config]);

  if (!config) return null;

  const handleSave = async () => {
    const val = parseInt(localVal, 10);
    if (isNaN(val) || val < 0) {
      setValidationError('Số tiền cọc phải là số nguyên không âm.');
      setStatus('err');
      return;
    }
    setSaving(true);
    setStatus('idle');
    setValidationError('');
    try {
      const updated = await updateBookingConfig(val);
      onSaveSuccess(updated);
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err: any) {
      setValidationError(err.message || 'Lỗi khi lưu cấu hình.');
      setStatus('err');
    } finally {
      setSaving(false);
    }
  };

  const isChanged = localVal !== String(config.depositAmount);

  return (
    <div style={{ background: C.white, borderRadius: C.radius, boxShadow: C.shadow, marginBottom: '1.25rem', overflow: 'hidden' }}>
      <div style={{ padding: '0.85rem 1.25rem', background: C.gray50, borderBottom: `2px solid ${C.gray200}` }}>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: C.gray800 }}>Đặt chỗ trước</p>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.gray200}`, background: C.gray100 }}>
            {['Khung áp dụng', 'Quy tắc', 'Đơn vị tính', 'Đơn giá (VND)', ''].map(h => (
              <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: `1px solid ${C.gray100}` }}>
            <td style={{ padding: '0.75rem 1rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.gray800 }}>Ô tô vãng lai</span>
            </td>
            <td style={{ padding: '0.75rem 1rem' }}>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: 20,
                background: '#E0F2FE',
                color: '#0369A1',
              }}>
                Phí đặt cọc
              </span>
            </td>
            <td style={{ padding: '0.75rem 1rem' }}>
              <span style={{ fontSize: '0.82rem', color: C.gray600 }}>Mỗi lượt đặt chỗ</span>
            </td>
            <td style={{ padding: '0.75rem 1rem', minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  value={localVal}
                  onChange={e => {
                    setLocalVal(e.target.value);
                    setValidationError('');
                    if (status === 'err') setStatus('idle');
                  }}
                  style={{
                    width: 110,
                    padding: '0.35rem 0.5rem',
                    border: `1.5px solid ${status === 'err' ? C.redBorder : C.gray200}`,
                    borderRadius: 6,
                    fontSize: '0.82rem',
                    color: C.gray800,
                    background: C.white,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !isChanged}
                  style={{
                    padding: '0.35rem 0.75rem',
                    background: saving || !isChanged ? C.gray200 : C.navy,
                    color: saving || !isChanged ? C.gray400 : C.white,
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: saving || !isChanged ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {saving ? '...' : status === 'ok' ? '✓' : 'Lưu'}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ padding: '0.75rem 1.25rem', borderTop: `1px solid ${C.gray200}`, background: C.gray50 }}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: C.gray500, lineHeight: 1.4 }}>
          Áp dụng cho lượt đặt chỗ mới. Các lượt đã tạo vẫn giữ nguyên mức đặt cọc ban đầu.
        </p>
        {validationError && (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: C.red, fontWeight: 600 }}>
            {validationError}
          </p>
        )}
      </div>
    </div>
  );
}

