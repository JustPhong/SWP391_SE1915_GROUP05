import { useState, useEffect } from 'react';
import { floorMapService, type FloorWithSlots, type MonthlyFloorQuotaSummary } from '../services/floorMap.service';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { ParkingSlot, Floor } from '../types';
import styles from '../styles/floorMap.module.css';

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════

function getSlotTier(tier?: string): 'vip' | 'popular' | 'basic' {
  const normalized = (tier || '').toUpperCase();
  if (normalized === 'VIP') return 'vip';
  if (normalized === 'POPULAR') return 'popular';
  return 'basic';
}

// Natural sorting helper that ensures 'G' (Ground Floor) comes first, followed by numeric floors.
function sortFloors(floors: Floor[]): Floor[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...floors].sort((a, b) => {
    if (a.floorCode === 'G' && b.floorCode !== 'G') return -1;
    if (b.floorCode === 'G' && a.floorCode !== 'G') return 1;
    return collator.compare(a.floorCode, b.floorCode);
  });
}

// Deterministic logic to group slots into rows for visual display.
// Display rows (A, B, C, D) are presentation-derived because there is no explicit row/zone field in the current database schema.
function groupSlotsIntoDisplayRows(slots: ParkingSlot[]): { label: string; slots: ParkingSlot[] }[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const sorted = [...slots].sort((a, b) => collator.compare(a.code, b.code));

  if (sorted.length === 20) {
    return [
      { label: 'A', slots: sorted.slice(0, 10) },
      { label: 'B', slots: sorted.slice(10, 20) },
    ];
  } else if (sorted.length === 40) {
    return [
      { label: 'A', slots: sorted.slice(0, 10) },
      { label: 'B', slots: sorted.slice(10, 20) },
      { label: 'C', slots: sorted.slice(20, 30) },
      { label: 'D', slots: sorted.slice(30, 40) },
    ];
  }

  const half = Math.ceil(sorted.length / 2);
  return [
    { label: 'A', slots: sorted.slice(0, half) },
    { label: 'B', slots: sorted.slice(half) },
  ];
}

// ═══════════════════════════════════════════════════════
//  QUOTA PANEL COMPONENT
// ═══════════════════════════════════════════════════════

const TIER_CONFIG = [
  { tier: 'VIP',     label: 'VIP',      icon: '👑', bg: '#FEF3C7', border: '#FDE68A', textColor: '#92400E', badgeBase: '#FDE68A' },
  { tier: 'POPULAR', label: 'Phổ biến', icon: '⭐', bg: '#EDE9FE', border: '#C4B5FD', textColor: '#5B21B6', badgeBase: '#C4B5FD' },
  { tier: 'REGULAR', label: 'Cơ bản',   icon: '●',  bg: '#F0F9FF', border: '#BAE6FD', textColor: '#0C4A6E', badgeBase: '#BAE6FD' },
] as const;

type TierKey = 'VIP' | 'POPULAR' | 'REGULAR';

function getQuotaStatus(sold: number, limit: number): { badge: string; availText: string; color: string; bg: string } {
  if (limit <= 0) return { badge: 'Chưa mở', availText: 'Chưa mở đăng ký', color: '#64748b', bg: '#F1F5F9' };
  const remaining = Math.max(0, limit - sold);
  if (remaining === 0) return { badge: 'Tạm hết', availText: 'Hiện đã hết suất đăng ký', color: '#dc2626', bg: '#FEE2E2' };
  if (remaining / limit <= 0.3) return { badge: 'Sắp hết', availText: `Còn ${remaining} suất đăng ký`, color: '#d97706', bg: '#FEF3C7' };
  return { badge: 'Còn đăng ký', availText: `Còn ${remaining} suất đăng ký`, color: '#16a34a', bg: '#DCFCE7' };
}

interface QuotaPanelProps {
  floorId: number;
  floorQuotaMap: Record<number, MonthlyFloorQuotaSummary>;
  quotaError: string | null;
  onRetry: (floorId: number) => void;
}

function QuotaPanel({ floorId, floorQuotaMap, quotaError, onRetry }: QuotaPanelProps) {
  const quotaData = floorQuotaMap[floorId];

  return (
    <div style={{
      margin: '0 1.5rem 1.25rem',
      background: '#F8FAFC',
      border: '1.5px solid #E2E8F0',
      borderRadius: 12,
      padding: '1rem 1.25rem',
    }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: '#1e3a5f' }}>Tình trạng đăng ký gói tháng</p>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
          Kiểm tra số suất đăng ký còn lại theo từng phân hạng.
        </p>
      </div>

      {!quotaData && quotaError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626', fontSize: '0.8rem', fontWeight: 500 }}>
          <span>Không thể tải tình trạng đăng ký gói tháng.</span>
          <button
            onClick={() => onRetry(floorId)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#2563EB', textDecoration: 'underline', fontSize: '0.78rem', padding: 0,
            }}
          >Thử lại</button>
        </div>
      )}

      {!quotaData && !quotaError && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Đang tải tình trạng đăng ký...</p>
      )}

      {quotaData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {TIER_CONFIG.map(cfg => {
            const q = quotaData.quotas.find(x => x.tier === (cfg.tier as TierKey));
            const limit = q?.limit ?? 0;
            const sold = q?.sold ?? 0;
            const status = getQuotaStatus(sold, limit);
            return (
              <div key={cfg.tier} style={{
                background: cfg.bg,
                border: `1.5px solid ${cfg.border}`,
                borderRadius: 10,
                padding: '0.75rem 0.875rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '13px', lineHeight: 1 }}>{cfg.icon}</span>
                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: cfg.textColor }}>{cfg.label}</span>
                </div>
                <span style={{ fontSize: '0.78rem', color: '#374151', fontWeight: 500 }}>
                  {status.availText}
                </span>
                <span style={{
                  marginTop: '0.2rem',
                  display: 'inline-block',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: status.color,
                  background: status.bg,
                  padding: '2px 7px',
                  borderRadius: 6,
                  alignSelf: 'flex-start',
                }}>{status.badge}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  SLOT CARD COMPONENT
// ═══════════════════════════════════════════════════════

interface SlotCardProps {
  slot: ParkingSlot;
  customerType: string;
}

function SlotCard({ slot, customerType }: SlotCardProps) {
  const isMonthly = customerType === 'MONTHLY';

  if (isMonthly) {
    const tier = getSlotTier(slot.tier);

    // Background is determined by tier
    let cardClass: string;
    if (tier === 'vip') {
      cardClass = styles.slotVip;
    } else if (tier === 'popular') {
      cardClass = styles.slotPopular;
    } else {
      cardClass = styles.slotAvailable;
    }

    // Tier badge (crown/star)
    let badge: JSX.Element | null = null;
    if (tier === 'vip') {
      badge = <span className={styles.slotMarkerVip}>👑</span>;
    } else if (tier === 'popular') {
      badge = <span className={styles.slotMarkerPopular}>⭐</span>;
    }

    const tierLabel = tier === 'vip' ? 'VIP' : tier === 'popular' ? 'Phổ biến' : 'Cơ bản';
    const tooltip = `Vị trí: ${slot.code} | Phân hạng: ${tierLabel}`;

    return (
      <div
        className={`${styles.slotCard} ${cardClass}`}
        title={tooltip}
      >
        <span className={styles.slotCode}>{slot.code}</span>
        {badge}
      </div>
    );
  } else {
    // CASUAL Floor: neutral, consistent card style
    const cardClass = styles.slotNeutral;
    const tooltip = `Vị trí tham khảo: ${slot.code}`;

    return (
      <div
        className={`${styles.slotCard} ${cardClass}`}
        title={tooltip}
      >
        <span className={styles.slotCode}>{slot.code}</span>
      </div>
    );
  }
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function FloorMapPage() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorSlotsMap, setFloorSlotsMap] = useState<Record<string, FloorWithSlots>>({});
  const [floorQuotaMap, setFloorQuotaMap] = useState<Record<number, MonthlyFloorQuotaSummary>>({});
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load floors and slots on mount
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedFloors = await floorMapService.getAllFloors();
      const sortedFloors = sortFloors(fetchedFloors);
      setFloors(sortedFloors);

      const slotsPromises = sortedFloors.map(floor => floorMapService.getSlotsByFloor(floor.floorCode));
      const slotsData = await Promise.all(slotsPromises);

      const mapped: Record<string, FloorWithSlots> = {};
      slotsData.forEach(item => {
        mapped[item.floorCode] = item;
      });
      setFloorSlotsMap(mapped);

      // Fetch per-floor quotas for monthly floors only — does not block physical slot display
      const monthlyFloors = sortedFloors.filter(f => f.customerType === 'MONTHLY');
      if (monthlyFloors.length > 0) {
        try {
          const quotaResults = await Promise.all(monthlyFloors.map(f => floorMapService.getFloorQuotas(f.id)));
          const quotaMapped: Record<number, MonthlyFloorQuotaSummary> = {};
          quotaResults.forEach(q => { quotaMapped[q.floorId] = q; });
          setFloorQuotaMap(quotaMapped);
          setQuotaError(null);
        } catch {
          setQuotaError('Không thể tải chỉ tiêu gói tháng.');
        }
      }

    } catch (err) {
      console.error('Failed to load floor map data:', err);
      setError('Đã xảy ra lỗi khi tải sơ đồ bãi đỗ xe.');
    } finally {
      setLoading(false);
    }
  };

  const retryFloorQuota = async (floorId: number) => {
    try {
      const q = await floorMapService.getFloorQuotas(floorId);
      setFloorQuotaMap(prev => ({ ...prev, [q.floorId]: q }));
      setQuotaError(null);
    } catch {
      setQuotaError('Không thể tải chỉ tiêu gói tháng.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRefreshOnFocus({ enabled: true, onRefresh: loadData });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 500 }}>Đang tải sơ đồ bãi đỗ xe...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 320, gap: '1rem' }}>
        <p style={{ color: '#ef4444', fontSize: '0.95rem', fontWeight: 500 }}>{error}</p>
        <button
          onClick={loadData}
          style={{
            background: '#2d5fd0',
            color: '#ffffff',
            border: 'none',
            padding: '0.5rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 500 }}>Không tìm thấy dữ liệu tầng.</p>
      </div>
    );
  }

  // Tier grouping is read directly from ParkingSlot.tier returned by the API.
  // No sold-quota slot locking — packages are floor+tier access, not concrete-slot reservations.

  return (
    <div className={styles.container}>
      {/* 1. Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Sơ đồ bãi đỗ xe</h1>
        <p className={styles.subtitle}>Tổng quan tình trạng chỗ đỗ theo từng tầng</p>
      </div>


      {/* 3. Floors responsive vertical list */}
      <div className={styles.grid}>
        {floors.map(floor => {
          const floorData = floorSlotsMap[floor.floorCode];
          const slots = floorData?.slots ?? [];
          const isCarMonthly = floor.customerType === 'MONTHLY' && floor.vehicleType === 'CAR';
          const isMonthlyMotorbike = floor.customerType === 'MONTHLY' && floor.vehicleType === 'MOTORBIKE';

          const rows = groupSlotsIntoDisplayRows(slots);

          const vehicleIcon = floor.vehicleType === 'CAR' ? '🚗' : '🛵';
          const vehicleText = floor.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy';
          const customerText = floor.customerType === 'MONTHLY' ? 'Khách tháng' : 'Khách vãng lai';

          const totalCapacity = floorData?.totalCapacity ?? floor.capacity ?? slots.length;
          const activeParkingCount = floorData?.activeParkingCount ?? floor.activeParkingCount ?? 0;
          const physicalAvailableCapacity = floorData?.physicalAvailableCapacity ?? floor.physicalAvailableCapacity ?? Math.max(0, totalCapacity - activeParkingCount);
          const activeBookingCount = floorData?.activeBookingCount ?? floor.activeBookingCount ?? 0;
          const receivableCapacity = floorData?.receivableCapacity ?? floor.receivableCapacity ?? Math.max(0, physicalAvailableCapacity - activeBookingCount);

          return (
            <div key={floor.id} className={styles.floorCard}>
              <div className={styles.floorHeader}>
                <div className={styles.floorTitleGroup}>
                  <div className={styles.floorIconCircle}>{vehicleIcon}</div>
                  <div className={styles.floorTitleContainer}>
                    <h2 className={styles.floorTitle}>{floor.name}</h2>
                    <p className={styles.floorSubtitle}>{vehicleText} • {customerText}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748b', fontWeight: 500, lineHeight: 1.4 }}>
                      {activeParkingCount}/{totalCapacity} xe đang đỗ
                      {floor.customerType === 'CASUAL' && activeBookingCount > 0 && (
                        <> · {activeBookingCount} suất đặt trước</>
                      )}
                      {' · '}Còn tiếp nhận {receivableCapacity} xe
                    </p>
                  </div>
                </div>
                <div className={styles.floorBadge} style={{ flexShrink: 0 }}>
                  Còn {receivableCapacity} chỗ
                </div>
              </div>

              {(isCarMonthly || isMonthlyMotorbike) && (
                <div className={styles.floorNote}>
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>ℹ️</span>
                  <div>
                    <p style={{ margin: '0 0 0.15rem', fontWeight: 700, fontSize: '0.82rem', color: '#1e3a5f' }}>
                      Phân hạng gói tháng
                    </p>
                    <p className={styles.floorNoteText}>
                      Mỗi phân hạng có số lượng đăng ký giới hạn. Khách được chọn bất kỳ vị trí trống nào thuộc phân hạng của gói; hệ thống không giữ cố định từng ô.
                    </p>
                  </div>
                </div>
              )}

              {(isCarMonthly || isMonthlyMotorbike) && (
                <QuotaPanel
                  floorId={floor.id}
                  floorQuotaMap={floorQuotaMap}
                  quotaError={quotaError}
                  onRetry={retryFloorQuota}
                />
              )}


              <div className={styles.slotGridWrapper}>
                <div className={styles.slotMapBody}>
                  <div className={styles.directionGuide}>
                    <div className={styles.directionItem}>
                      <span>Lối vào</span>
                      <span className={styles.arrowRight}>→</span>
                    </div>
                    <div className={styles.directionItem}>
                      <span className={styles.arrowLeft}>←</span>
                      <span>Lối ra</span>
                    </div>
                  </div>

                  <div className={styles.slotsGrid}>
                    {rows.map(row => (
                      <div key={row.label} className={styles.rowContainer}>
                        <div className={styles.rowLabel}>{row.label}</div>
                        <div className={styles.slotsRow}>
                          {row.slots.map(slot => (
                            <SlotCard key={slot.id} slot={slot} customerType={floor.customerType} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tier legend — motorbike monthly floor */}
              {isMonthlyMotorbike && (
                <div className={styles.tierLegend}>
                  <div className={styles.tierLegendItem}>
                    <span>👑 VIP — Vị trí ưu tiên</span>
                  </div>
                  <div className={styles.tierLegendItem}>
                    <span>⭐ Phổ biến — Vị trí được ưa chuộng</span>
                  </div>
                  <div className={styles.tierLegendItem}>
                    <span className={styles.tierIndicatorBasic} />
                    <span>Cơ bản — Vị trí tiêu chuẩn</span>
                  </div>
                </div>
              )}

              {/* Tier legend — car monthly floor (floor G) */}
              {isCarMonthly && (
                <div className={styles.tierLegend}>
                  <div className={styles.tierLegendItem}>
                    <span>👑 VIP — Vị trí ưu tiên</span>
                  </div>
                  <div className={styles.tierLegendItem}>
                    <span>⭐ Phổ biến — Vị trí được ưa chuộng</span>
                  </div>
                  <div className={styles.tierLegendItem}>
                    <span className={styles.tierIndicatorBasic} />
                    <span>Cơ bản — Vị trí tiêu chuẩn</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Trust/Info Card Section */}
      <div className={styles.trustSection}>
        <div className={styles.trustCard}>
          <div className={styles.trustIconCircle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className={styles.trustContent}>
            <h3 className={styles.trustTitle}>Lưu ý</h3>
            <p className={styles.trustDesc}>Vui lòng đỗ xe đúng vị trí và tuân thủ nội quy bãi đỗ xe.</p>
          </div>
        </div>

        <div className={styles.trustCard}>
          <div className={styles.trustIconCircle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 11 2 2 4-4" />
            </svg>
          </div>
          <div className={styles.trustContent}>
            <h3 className={styles.trustTitle}>An toàn & bảo mật</h3>
            <p className={styles.trustDesc}>Hệ thống giám sát 24/7 đảm bảo an toàn cho phương tiện.</p>
          </div>
        </div>

        <div className={styles.trustCard}>
          <div className={styles.trustIconCircle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <div className={styles.trustContent}>
            <h3 className={styles.trustTitle}>Hỗ trợ 24/7</h3>
            <p className={styles.trustDesc}>Đội ngũ hỗ trợ luôn sẵn sàng giúp bạn mọi lúc.</p>
          </div>
        </div>

        <div className={styles.trustCard}>
          <div className={styles.trustIconCircle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className={styles.trustContent}>
            <h3 className={styles.trustTitle}>Thanh toán an toàn</h3>
            <p className={styles.trustDesc}>Giao dịch được mã hóa và bảo vệ tuyệt đối.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
