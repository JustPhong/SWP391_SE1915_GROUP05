import { useState, useEffect } from 'react';
import { floorMapService, type FloorWithSlots } from '../services/floorMap.service';
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

function getSlotStatus(slot: ParkingSlot, floorCode: string): 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MONTHLY' {
  const isMonthly = slot.isFixed || slot.assignedVehicleId !== null;
  
  if (floorCode === 'G' || floorCode === '1') {
    // Monthly floors
    if (isMonthly) {
      return 'MONTHLY';
    }
    if (slot.status === 'OCCUPIED') {
      return 'OCCUPIED';
    }
    if (slot.status === 'RESERVED') {
      return 'RESERVED';
    }
    return 'AVAILABLE';
  } else {
    // Visitor floors
    if (slot.status === 'OCCUPIED') return 'OCCUPIED';
    if (slot.status === 'RESERVED') return 'RESERVED';
    return 'AVAILABLE';
  }
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
//  SLOT CARD COMPONENT
// ═══════════════════════════════════════════════════════

interface SlotCardProps {
  slot: ParkingSlot;
  floor: Floor;
  isSoldQuota?: boolean;
}

function SlotCard({ slot, floor, isSoldQuota }: SlotCardProps) {
  const floorCode = floor.floorCode;
  let cardClass = styles.slotAvailable;
  let badge: JSX.Element | null = null;
  const displayStatus = isSoldQuota ? 'MONTHLY' : getSlotStatus(slot, floorCode);

  // Determine visual status
  if (displayStatus === 'MONTHLY') {
    cardClass = styles.slotMonthly;
  } else if (displayStatus === 'OCCUPIED') {
    cardClass = styles.slotOccupied;
  } else if (displayStatus === 'RESERVED') {
    cardClass = styles.slotReserved;
  } else {
    // AVAILABLE
    const tier = getSlotTier(slot.tier);
    if (tier === 'vip') {
      cardClass = styles.slotVip;
    } else if (tier === 'popular') {
      cardClass = styles.slotPopular;
    }
  }

  // Floating crown/star in corner for all VIP/Popular slots (visual decoration only)
  const tier = getSlotTier(slot.tier);
  if (tier === 'vip') {
    badge = <span className={styles.slotMarkerVip}>👑</span>;
  } else if (tier === 'popular') {
    badge = <span className={styles.slotMarkerPopular}>⭐</span>;
  }

  // Determine small status symbol below code
  let statusIcon = '✓';
  if (displayStatus === 'MONTHLY') {
    statusIcon = '🔒';
  } else if (displayStatus === 'RESERVED') {
    statusIcon = '🕒';
  } else if (displayStatus === 'OCCUPIED') {
    statusIcon = '●';
  }

  const tooltip = isSoldQuota
    ? `Vị trí: ${slot.code} | Trạng thái: Chỉ báo chỉ tiêu đăng ký gói hoạt động (Khu vực VIP/Phổ biến/Cơ bản)`
    : `Vị trí: ${slot.code} | Trạng thái: ${slot.status === 'OCCUPIED' ? 'Đang đỗ xe' : slot.status === 'RESERVED' ? 'Đã đặt trước' : 'Đang trống'}`;

  return (
    <div
      className={`${styles.slotCard} ${cardClass}`}
      title={tooltip}
    >
      <span className={styles.slotCode}>{slot.code}</span>
      <span className={styles.slotSymbol}>{statusIcon}</span>
      {badge}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function FloorMapPage() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorSlotsMap, setFloorSlotsMap] = useState<Record<string, FloorWithSlots>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Record<string, { capacity: number; sold: number; remaining: number }>>({
    VIP: { capacity: 4, sold: 0, remaining: 4 },
    POPULAR: { capacity: 8, sold: 0, remaining: 8 },
    REGULAR: { capacity: 8, sold: 0, remaining: 8 },
  });

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

      try {
        const zoneQuotas = await floorMapService.getZoneQuotas();
        if (zoneQuotas) {
          setQuotas(zoneQuotas);
        }
      } catch (qErr) {
        console.error('Failed to load zone quotas:', qErr);
      }
    } catch (err) {
      console.error('Failed to load floor map data:', err);
      setError('Đã xảy ra lỗi khi tải sơ đồ bãi đỗ xe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  // Precompute Floor G quota indicator slots
  const floorGSlots = floorSlotsMap['G']?.slots || [];
  const vipGSlots = floorGSlots.filter(s => s.tier === 'VIP').sort((a, b) => a.code.localeCompare(b.code));
  const popularGSlots = floorGSlots.filter(s => s.tier === 'POPULAR').sort((a, b) => a.code.localeCompare(b.code));
  const regularGSlots = floorGSlots.filter(s => s.tier === 'REGULAR').sort((a, b) => a.code.localeCompare(b.code));

  const soldQuotaSlotCodes = new Set<string>();
  const vipSold = quotas.VIP?.sold || 0;
  vipGSlots.slice(0, vipSold).forEach(s => soldQuotaSlotCodes.add(s.code));
  const popularSold = quotas.POPULAR?.sold || 0;
  popularGSlots.slice(0, popularSold).forEach(s => soldQuotaSlotCodes.add(s.code));
  const regularSold = quotas.REGULAR?.sold || 0;
  regularGSlots.slice(0, regularSold).forEach(s => soldQuotaSlotCodes.add(s.code));

  return (
    <div className={styles.container}>
      {/* 1. Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Sơ đồ bãi đỗ xe</h1>
        <p className={styles.subtitle}>Tổng quan tình trạng chỗ đỗ theo từng tầng</p>
      </div>

      {/* 2. Legend Card */}
      <div className={styles.legendCard}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e3a5f' }}>
            Chú giải trạng thái
          </h2>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
            Màu sắc hiển thị trạng thái hiện tại của từng vị trí đỗ xe
          </p>
        </div>
        <div className={styles.legendList}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendBadge} ${styles.badgeGreen}`} />
            <span style={{ color: '#16a34a' }}>Trống</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendBadge} ${styles.badgeRed}`} />
            <span style={{ color: '#dc2626' }}>Đã mua gói tháng</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendBadge} ${styles.badgeOrange}`} />
            <span style={{ color: '#d97706' }}>Đã đặt trước</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendBadge} ${styles.badgeGray}`} />
            <span style={{ color: '#475569' }}>Đang sử dụng</span>
          </div>
        </div>
      </div>

      {/* 3. Floors responsive vertical list */}
      <div className={styles.grid}>
        {floors.map(floor => {
          const floorData = floorSlotsMap[floor.floorCode];
          const slots = floorData?.slots ?? [];
          const availCount = slots.filter(s => {
            const isSoldQuota = floor.floorCode === 'G' && soldQuotaSlotCodes.has(s.code);
            return !isSoldQuota && getSlotStatus(s, floor.floorCode) === 'AVAILABLE';
          }).length;
          const rows = groupSlotsIntoDisplayRows(slots);

          const isMonthlyMotorbike = floor.customerType === 'MONTHLY' && floor.vehicleType === 'MOTORBIKE';
          const vehicleIcon = floor.vehicleType === 'CAR' ? '🚗' : '🛵';
          const vehicleText = floor.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy';
          const customerText = floor.customerType === 'MONTHLY' ? 'Khách tháng' : 'Khách vãng lai';

          return (
            <div key={floor.id} className={styles.floorCard}>
              <div className={styles.floorHeader}>
                <div className={styles.floorTitleGroup}>
                  <div className={styles.floorIconCircle}>{vehicleIcon}</div>
                  <div className={styles.floorTitleContainer}>
                    <h2 className={styles.floorTitle}>{floor.name}</h2>
                    <p className={styles.floorSubtitle}>{vehicleText} • {customerText}</p>
                  </div>
                </div>
                <div className={styles.floorBadge}>
                  {isMonthlyMotorbike 
                    ? `${slots.length}/${slots.length} sức chứa`
                    : `${availCount}/${slots.length} chỗ trống`
                  }
                </div>
              </div>

              {isMonthlyMotorbike && (
                <div className={styles.floorNote}>
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>ℹ️</span>
                  <p className={styles.floorNoteText}>
                    Khách tháng được sử dụng khu vực này, không giữ cố định từng ô.
                  </p>
                </div>
              )}

              {floor.floorCode === 'G' && floor.vehicleType === 'CAR' && floor.customerType === 'MONTHLY' && (
                <div className={styles.floorNote}>
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>ℹ️</span>
                  <p className={styles.floorNoteText}>
                    Các ô có biểu tượng khóa (🔒) biểu thị chỉ tiêu gói đăng ký hoạt động trong phân hạng, không phải vị trí cố định riêng. Khách hàng có thể đỗ tại vị trí trống bất kỳ trong phân hạng VIP, Phổ biến, hoặc Cơ bản.
                  </p>
                </div>
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
                          {row.slots.map(slot => {
                            const isSoldQuota = floor.floorCode === 'G' && soldQuotaSlotCodes.has(slot.code);
                            return (
                              <SlotCard key={slot.id} slot={slot} floor={floor} isSoldQuota={isSoldQuota} />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Render Legend Card only on Floor G to match VIP/Popular indicators */}
              {floor.floorCode === 'G' && floor.vehicleType === 'CAR' && floor.customerType === 'MONTHLY' && (
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
