import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listBookings,
  fulfillBooking,
  cancelBooking,
  type BookingItem,
  type BookingStatus,
} from '../api/bookingApi';

const C = {
  navy:       '#1E3A5F',
  white:      '#FFFFFF',
  green:      '#16A34A',
  greenBg:    '#DCFCE7',
  greenBorder:'#86EFAC',
  red:        '#DC2626',
  redBg:      '#FEE2E2',
  redBorder:  '#FECACA',
  amber:      '#B45309',
  amberBg:    '#FEF3C7',
  amberBorder:'#FDE68A',
  gray50:     '#F9FAFB',
  gray100:    '#F3F5F7',
  gray200:    '#E5E7EB',
  gray400:    '#9CA3AF',
  gray500:    '#6B7280',
  gray600:    '#5C6B7A',
  gray800:    '#111827',
  shadow:     '0 8px 32px rgba(30,58,95,0.08)',
  radius:     18,
};

const NO_SHOW_CUTOFF_MINUTES = 15;

type TabKey = BookingStatus;
const TABS: { key: TabKey; label: string }[] = [
  { key: 'ACTIVE',    label: 'Đang chờ' },
  { key: 'FULFILLED', label: 'Đã vào' },
  { key: 'CANCELLED', label: 'Đã hủy' },
  { key: 'NO_SHOW',   label: 'Vắng mặt' },
];

type Toast = { message: string; type: 'success' | 'error' } | null;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ToastBanner({ toast, onClear }: { toast: Toast; onClear: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClear, 3500);
    return () => clearTimeout(t);
  }, [toast, onClear]);
  if (!toast) return null;
  const bg = toast.type === 'success' ? C.greenBg : C.redBg;
  const text = toast.type === 'success' ? '#15803D' : C.red;
  const border = toast.type === 'success' ? C.greenBorder : C.redBorder;
  return (
    <div style={{
      position: 'fixed', top: 20, right: 24, zIndex: 9999,
      background: bg, border: `1.5px solid ${border}`, borderRadius: 12,
      padding: '12px 20px', color: text, fontWeight: 600, fontSize: '0.9rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxWidth: 400,
    }}>
      {toast.message}
    </div>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  if (status === 'FULFILLED') {
    return (
      <span style={{
        display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 20,
        fontSize: '0.72rem', fontWeight: 700,
        background: C.greenBg, color: '#15803D', border: `1px solid ${C.greenBorder}`,
      }}>
        Đã vào
      </span>
    );
  }
  if (status === 'CANCELLED') {
    return (
      <span style={{
        display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 20,
        fontSize: '0.72rem', fontWeight: 700,
        background: C.gray100, color: C.gray600, border: `1px solid ${C.gray200}`,
      }}>
        Đã hủy
      </span>
    );
  }
  if (status === 'NO_SHOW') {
    return (
      <span style={{
        display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 20,
        fontSize: '0.72rem', fontWeight: 700,
        background: C.amberBg, color: C.amber, border: `1px solid ${C.amberBorder}`,
      }}>
        Vắng mặt
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 20,
      fontSize: '0.72rem', fontWeight: 700,
      background: '#EFF6FF', color: C.navy, border: '1px solid #BFDBFE',
    }}>
      Đang chờ
    </span>
  );
}

function CountdownCell({ expectedArrival, tick }: { expectedArrival: string; tick: number }) {
  void tick; // re-derive every second
  const arrival = new Date(expectedArrival).getTime();
  if (isNaN(arrival)) {
    return <span style={{ fontSize: '0.82rem', color: C.gray400 }}>—</span>;
  }
  const deadline = arrival + NO_SHOW_CUTOFF_MINUTES * 60 * 1000;
  const remainingMs = deadline - Date.now();

  if (remainingMs > 0) {
    const totalSec = Math.floor(remainingMs / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return (
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.navy }}>
        Còn {mm} phút {String(ss).padStart(2, '0')}s
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 20,
      fontSize: '0.72rem', fontWeight: 700,
      background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`,
    }}>
      Quá hạn — sẽ tự hủy
    </span>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(17,24,39,0.45)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: C.white, borderRadius: 16, padding: '1.5rem',
        width: 420, boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: 800, color: C.navy }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: C.gray600, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.6rem 1.1rem', background: C.white, color: C.gray600,
              border: `1.5px solid ${C.gray200}`, borderRadius: 10,
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.6rem 1.1rem', background: confirmColor, color: C.white,
              border: 'none', borderRadius: 10,
              fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BookingManagementPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('ACTIVE');
  const [toast, setToast] = useState<Toast>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: 'fulfill'; booking: BookingItem }
    | { kind: 'cancel'; booking: BookingItem }
    | null
  >(null);
  const [tick, setTick] = useState(0);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBookings();
      setBookings(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách đặt chỗ.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live countdown for the ACTIVE tab
  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (tab !== 'ACTIVE') return;
    tickRef.current = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [tab]);

  const filtered = useMemo(
    () => bookings.filter((b) => b.status === tab),
    [bookings, tab]
  );

  const handleFulfill = async (id: string) => {
    setBusyId(id);
    try {
      await fulfillBooking(id);
      showToast('Đã xác nhận khách đến.', 'success');
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xác nhận khách đến.';
      showToast(msg, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setBusyId(id);
    try {
      await cancelBooking(id);
      showToast('Đã hủy lượt đặt chỗ.', 'success');
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể hủy đặt chỗ.';
      showToast(msg, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: '0 0.25rem' }}>
      <ToastBanner toast={toast} onClear={() => setToast(null)} />

      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: C.navy }}>
          Quản lý đặt chỗ
        </h1>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: C.gray500 }}>
          Xác nhận khách đến hoặc hủy các lượt đặt chỗ
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, background: C.gray100, padding: 4,
        borderRadius: 12, marginBottom: '1rem', width: 'fit-content',
      }}>
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const count = bookings.filter((b) => b.status === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '0.5rem 1rem',
                background: isActive ? C.white : 'transparent',
                color: isActive ? C.navy : C.gray600,
                border: 'none', borderRadius: 8,
                fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              {t.label}
              <span style={{
                display: 'inline-block', minWidth: 22, textAlign: 'center',
                padding: '0 0.4rem', borderRadius: 999,
                fontSize: '0.72rem', fontWeight: 700,
                background: isActive ? C.navy : C.gray200,
                color: isActive ? C.white : C.gray600,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table card */}
      <div style={{
        background: C.white, borderRadius: C.radius, boxShadow: C.shadow,
        overflow: 'hidden',
      }}>
        {loading ? (
          <p style={{ margin: 0, padding: '2rem', textAlign: 'center', color: C.gray400, fontSize: '0.95rem' }}>
            Đang tải...
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ margin: 0, padding: '2rem', textAlign: 'center', color: C.gray400, fontSize: '0.95rem' }}>
            Không có lượt đặt chỗ nào.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: C.gray50, borderBottom: `2px solid ${C.gray200}` }}>
                  {[
                    'Biển số',
                    'Vị trí',
                    'Giờ đặt',
                    'Giờ hẹn đến',
                    ...(tab === 'ACTIVE' ? ['Đếm ngược'] : ['Trạng thái']),
                    'Thao tác',
                  ].map((h) => (
                    <th key={h} style={{
                      padding: '0.7rem 1rem', textAlign: 'left',
                      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: C.gray500,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{
                      padding: '0.7rem 1rem',
                      fontFamily: "'Consolas','Courier New',monospace",
                      fontWeight: 700, color: C.navy, letterSpacing: '0.02em',
                    }}>
                      {b.vehicle.plateNumber}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: C.gray800, fontWeight: 600 }}>
                      {b.slot.code}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: C.gray600 }}>
                      {formatDateTime(b.bookingTime)}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: C.gray600 }}>
                      {formatDateTime(b.expectedArrival)}
                    </td>
                    {tab === 'ACTIVE' ? (
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <CountdownCell expectedArrival={b.expectedArrival} tick={tick} />
                      </td>
                    ) : (
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <StatusBadge status={b.status} />
                      </td>
                    )}
                    <td style={{ padding: '0.7rem 1rem' }}>
                      {tab === 'ACTIVE' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setConfirm({ kind: 'fulfill', booking: b })}
                            disabled={busyId === b.id}
                            style={{
                              padding: '0.4rem 0.85rem',
                              background: busyId === b.id ? C.gray200 : C.navy,
                              color: busyId === b.id ? C.gray400 : C.white,
                              border: 'none', borderRadius: 8,
                              fontSize: '0.78rem', fontWeight: 700,
                              cursor: busyId === b.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Xác nhận khách đến
                          </button>
                          <button
                            onClick={() => setConfirm({ kind: 'cancel', booking: b })}
                            disabled={busyId === b.id}
                            style={{
                              padding: '0.4rem 0.85rem',
                              background: busyId === b.id ? C.gray200 : C.red,
                              color: busyId === b.id ? C.gray400 : C.white,
                              border: 'none', borderRadius: 8,
                              fontSize: '0.78rem', fontWeight: 700,
                              cursor: busyId === b.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: C.gray400 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm?.kind === 'fulfill' && (
        <ConfirmDialog
          title="Xác nhận khách đến"
          message={`Xác nhận khách biển số "${confirm.booking.vehicle.plateNumber}" đã đến vị trí ${confirm.booking.slot.code}?`}
          confirmLabel="Xác nhận"
          confirmColor={C.navy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const id = confirm.booking.id;
            setConfirm(null);
            await handleFulfill(id);
          }}
        />
      )}

      {confirm?.kind === 'cancel' && (
        <ConfirmDialog
          title="Hủy lượt đặt chỗ"
          message="Hủy lượt đặt này? Tiền cọc sẽ bị mất theo quy định."
          confirmLabel="Hủy đặt chỗ"
          confirmColor={C.red}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const id = confirm.booking.id;
            setConfirm(null);
            await handleCancel(id);
          }}
        />
      )}
    </div>
  );
}
