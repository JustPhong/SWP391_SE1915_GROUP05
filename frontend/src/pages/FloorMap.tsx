import { useState, useEffect } from 'react';
import { floorMapService, type FloorWithSlots } from '../services/floorMap.service';
import type { ParkingSlot } from '../types';
import styles from '../styles/floorMap.module.css';

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════

function getSlotTier(code: string): 'vip' | 'popular' | 'basic' {
  if (['G-01', 'G-02', 'G-11', 'G-12'].includes(code)) return 'vip';
  if (['G-03', 'G-04', 'G-05', 'G-06', 'G-13', 'G-14', 'G-15', 'G-16'].includes(code)) return 'popular';
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

// ═══════════════════════════════════════════════════════
//  SLOT CARD COMPONENT
// ═══════════════════════════════════════════════════════

interface SlotCardProps {
  slot: ParkingSlot;
  floorCode: string;
}

function SlotCard({ slot, floorCode }: SlotCardProps) {

  let cardClass = styles.slotAvailable;
  let badge: JSX.Element | null = null;
  const displayStatus = getSlotStatus(slot, floorCode);

  // Determine visual status
  if (displayStatus === 'MONTHLY') {
    cardClass = styles.slotMonthly;
  } else if (displayStatus === 'OCCUPIED') {
    cardClass = styles.slotOccupied;
  } else if (displayStatus === 'RESERVED') {
    cardClass = styles.slotReserved;
  } else {
    // AVAILABLE
    const tier = floorCode === 'G' ? getSlotTier(slot.code) : 'basic';
    if (floorCode === 'G') {
      if (tier === 'vip') {
        cardClass = styles.slotVip;
      } else if (tier === 'popular') {
        cardClass = styles.slotPopular;
      }
    }
  }

  // Floating crown/star in corner for all G VIP/Popular slots
  if (floorCode === 'G') {
    const tier = getSlotTier(slot.code);
    if (tier === 'vip') {
      badge = <span className={styles.slotMarkerVip}>👑</span>;
    } else if (tier === 'popular') {
      badge = <span className={styles.slotMarkerPopular}>⭐</span>;
    }
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

  return (
    <div
      className={`${styles.slotCard} ${cardClass}`}
      title={`Vị trí: ${slot.code} | Trạng thái: ${slot.status}`}
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
  const [floorSlotsMap, setFloorSlotsMap] = useState<Record<string, FloorWithSlots>>({});
  const [loading, setLoading] = useState(true);

  // Load floors and slots on mount
  useEffect(() => {
    (async () => {
      try {

        const codes = ['G', '1', '2', '3'];
        const slotsPromises = codes.map(code => floorMapService.getSlotsByFloor(code));
        const slotsData = await Promise.all(slotsPromises);

        const mapped: Record<string, FloorWithSlots> = {};
        slotsData.forEach(item => {
          mapped[item.floorCode] = item;
        });
        setFloorSlotsMap(mapped);
      } catch (err) {
        console.error('Failed to load floor map data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getRows = (slots: ParkingSlot[]) => {
    const sorted = [...slots].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
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
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 500 }}>Đang tải sơ đồ bãi đỗ xe...</p>
      </div>
    );
  }

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

      {/* 3. Floors responsive 2-column grid */}
      <div className={styles.grid}>
        {/* TẦNG G CARD */}
        {(() => {
          const floorData = floorSlotsMap['G'];
          const slots = floorData?.slots ?? [];
          const availCount = slots.filter(s => getSlotStatus(s, 'G') === 'AVAILABLE').length;
          const rows = getRows(slots);

          return (
            <div className={styles.floorCard}>
              <div className={styles.floorHeader}>
                <div className={styles.floorTitleGroup}>
                  <div className={styles.floorIconCircle}>🚗</div>
                  <div className={styles.floorTitleContainer}>
                    <h2 className={styles.floorTitle}>Tầng G</h2>
                    <p className={styles.floorSubtitle}>Ô tô • Khách tháng</p>
                  </div>
                </div>
                <div className={styles.floorBadge}>{availCount}/{slots.length || 20} chỗ trống</div>
              </div>

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
                            <SlotCard key={slot.id} slot={slot} floorCode="G" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

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
            </div>
          );
        })()}

        {/* TẦNG 1 CARD */}
        {(() => {
          const floorData = floorSlotsMap['1'];
          const slots = floorData?.slots ?? [];
          const rows = getRows(slots);

          return (
            <div className={styles.floorCard}>
              <div className={styles.floorHeader}>
                <div className={styles.floorTitleGroup}>
                  <div className={styles.floorIconCircle}>🛵</div>
                  <div className={styles.floorTitleContainer}>
                    <h2 className={styles.floorTitle}>Tầng 1</h2>
                    <p className={styles.floorSubtitle}>Xe máy • Khách tháng</p>
                  </div>
                </div>
                <div className={styles.floorBadge}>{slots.length || 40}/{slots.length || 40} sức chứa</div>
              </div>

              <div className={styles.floorNote}>
                <span style={{ fontSize: '14px', lineHeight: 1 }}>ℹ️</span>
                <p className={styles.floorNoteText}>
                  Khách tháng được sử dụng khu vực này, không giữ cố định từng ô.
                </p>
              </div>

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
                            <SlotCard key={slot.id} slot={slot} floorCode="1" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TẦNG 2 CARD */}
        {(() => {
          const floorData = floorSlotsMap['2'];
          const slots = floorData?.slots ?? [];
          const availCount = slots.filter(s => getSlotStatus(s, '2') === 'AVAILABLE').length;
          const rows = getRows(slots);

          return (
            <div className={styles.floorCard}>
              <div className={styles.floorHeader}>
                <div className={styles.floorTitleGroup}>
                  <div className={styles.floorIconCircle}>🛵</div>
                  <div className={styles.floorTitleContainer}>
                    <h2 className={styles.floorTitle}>Tầng 2</h2>
                    <p className={styles.floorSubtitle}>Xe máy • Khách vãng lai</p>
                  </div>
                </div>
                <div className={styles.floorBadge}>{availCount}/{slots.length || 40} chỗ trống</div>
              </div>

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
                            <SlotCard key={slot.id} slot={slot} floorCode="2" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TẦNG 3 CARD */}
        {(() => {
          const floorData = floorSlotsMap['3'];
          const slots = floorData?.slots ?? [];
          const availCount = slots.filter(s => getSlotStatus(s, '3') === 'AVAILABLE').length;
          const rows = getRows(slots);

          return (
            <div className={styles.floorCard}>
              <div className={styles.floorHeader}>
                <div className={styles.floorTitleGroup}>
                  <div className={styles.floorIconCircle}>🚗</div>
                  <div className={styles.floorTitleContainer}>
                    <h2 className={styles.floorTitle}>Tầng 3</h2>
                    <p className={styles.floorSubtitle}>Ô tô • Khách vãng lai</p>
                  </div>
                </div>
                <div className={styles.floorBadge}>{availCount}/{slots.length || 20} chỗ trống</div>
              </div>

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
                            <SlotCard key={slot.id} slot={slot} floorCode="3" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
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
