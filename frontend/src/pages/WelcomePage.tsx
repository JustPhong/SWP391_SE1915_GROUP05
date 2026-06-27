import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentSession, getMyPackage, getHistory, CurrentSession, MyPackage, HistoryItem } from '../api/driverDashboardApi';
import { getMyVehicles, addVehicle, removeVehicle, Vehicle } from '../api/vehicleApi';
import styles from '../styles/welcome.module.css';

type Tab = 'home' | 'vehicles';

// ── Helpers ─────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buổi sáng';
  if (h < 17) return 'Buổi chiều';
  return 'Buổi tối';
}

function getTitle(time: Date): string {
  const h = time.getHours();
  if (h < 5)  return 'Vẫn chưa ngủ à?';
  if (h < 12) return 'Ngày mới tràn đầy năng lượng!';
  if (h < 14) return 'Buổi trưa rồi, xe đã đỗ chưa?';
  if (h < 17) return 'Chiều nay đỗ xe ở đâu?';
  if (h < 20) return 'Buổi tối, rảnh rỗi đỗ xe thôi!';
  if (h < 22) return 'Đêm vắng, bãi xe vẫn mở!';
  return 'Khuya rồi, cẩn thận nhé!';
}

// ── Component ──────────────────────────────────────────────
export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // ── User type detection ──────────────────────────────────
  // We fetch the package once to decide: monthly → /dashboard, casual → stay here
  const [pkgLoading, setPkgLoading] = useState(true);
  const [hasPackage, setHasPackage] = useState(false); // true = monthly customer

  useEffect(() => {
    if (!user) { setPkgLoading(false); return; }

    getMyPackage().then(pkg => {
      if (pkg) {
        // Monthly customer → redirect to full dashboard
        navigate('/dashboard', { replace: true });
      } else {
        // Casual user → stay on welcome page with tabs
        setHasPackage(false);
        setPkgLoading(false);
      }
    }).catch(() => setPkgLoading(false));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab state (casual users only) ─────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [pkg, setPkg] = useState<MyPackage | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Add vehicle form ─────────────────────────────────────
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState<'CAR' | 'MOTORBIKE'>('CAR');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // ── Fetch VCB data (casual users only) ──────────────────
  useEffect(() => {
    if (!user || hasPackage || pkgLoading) return;
    setLoading(true);
    Promise.all([getCurrentSession(), getMyPackage(), getMyVehicles()])
      .then(([s, p, v]) => { setSession(s); setPkg(p); setVehicles(v); })
      .finally(() => setLoading(false));
  }, [user, hasPackage, pkgLoading]);

  // ── Fetch history on demand ──────────────────────────────
  const [historyTab, setHistoryTab] = useState(false);
  useEffect(() => {
    if (!user || hasPackage || pkgLoading || !historyTab) return;
    setHistoryLoading(true);
    getHistory().then(setHistory).finally(() => setHistoryLoading(false));
  }, [user, hasPackage, pkgLoading, historyTab]);

  // ── Add vehicle ──────────────────────────────────────────
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;
    setAddLoading(true);
    setAddError('');
    try {
      const v = await addVehicle({ plateNumber: newPlate.trim().toUpperCase(), type: newType });
      setVehicles(prev => [...prev, v]);
      setShowAddVehicle(false);
      setNewPlate('');
      setNewType('CAR');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Thêm xe thất bại.');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Remove vehicle ───────────────────────────────────────
  const handleRemoveVehicle = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá xe này?')) return;
    try {
      await removeVehicle(id);
      setVehicles(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xoá xe thất bại.');
    }
  };

  // ── Formatters ───────────────────────────────────────────
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
  const daysLeft = (iso: string) =>
    Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // ── Loading screen while detecting user type ──────────────
  if (pkgLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f7ff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #dae9f5', borderTopColor: '#2d5fd0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <p style={{ color: '#8aacbf', fontSize: '0.9rem', margin: 0 }}>Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER — LOGGED OUT: full public landing page
  // ═══════════════════════════════════════════════════════════
  if (!user) {
    return (
      <div className={styles.page}>
        {/* ── 1. NAV ─────────────────────────────────────── */}
        <nav className={styles.nav}>
          <div className={styles.navInner}>
            <div className={styles.logo} onClick={() => navigate('/')}>
              <img src="/logo.png" alt="ParkSmart Logo" className={styles.logoImg} />
              <span className={styles.logoText}>Park<span className={styles.logoTextAccent}>Smart</span></span>
            </div>
            <div className={styles.navRight}>
              <span className={styles.navSupport}>Hỗ trợ</span>
              <button className={styles.btnGhost} onClick={() => navigate('/login')}>Đăng nhập</button>
              <button className={styles.btnPrimary} onClick={() => navigate('/register')}>Đăng ký</button>
            </div>
          </div>
        </nav>

        <HeroSection navigate={navigate} />
        <CasualPricingSection navigate={navigate} />
        <FeaturesSection />
        <ProcessSection />
        <PricingSection navigate={navigate} />
        <CtaBand navigate={navigate} />
        <Footer navigate={navigate} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER — CASUAL LOGGED-IN USER (hasPackage=false, pkgLoading=false)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className={styles.page}>
      {/* ── 1. NAV ─────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logo} onClick={() => { setActiveTab('home'); }}>
            <img src="/logo.png" alt="ParkSmart Logo" className={styles.logoImg} />
            <span className={styles.logoText}>Park<span className={styles.logoTextAccent}>Smart</span></span>
          </div>

          {/* Tab switcher */}
          <div className={styles.tabSwitcher}>
            <button className={`${styles.tabBtn} ${activeTab === 'home' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('home')}>
              Trang chủ
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'vehicles' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('vehicles')}>
              Xe của bạn
            </button>
          </div>

          <div className={styles.navRight}>
            <span className={styles.userGreeting}>{user.fullName}</span>
            <button className={styles.btnGhost} onClick={() => { logout(); navigate('/'); }}>
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      {/* ── TAB CONTENT ─────────────────────────────────── */}
      {activeTab === 'home' ? (
        <>
          <HeroLoggedIn user={user} session={session} navigate={navigate} />
          <CasualPricingSection navigate={navigate} />
          <FeaturesSection />
          <ProcessSection />
          <PricingSection navigate={navigate} />
          <CtaBand navigate={navigate} />
          <Footer navigate={navigate} />
        </>
      ) : (
        /* ── XE CUA BAN ──────────────────────────────── */
        <div className={styles.vcbPage}>
          <div className={styles.vcbInner}>
            <div className={styles.vcbHeader}>
              <div>
                <h1 className={styles.vcbTitle}>Xe của bạn</h1>
                <p className={styles.vcbSubtitle}>Quản lý xe đã đăng ký, gói tháng và lịch sử gửi xe.</p>
              </div>
              <button className={styles.btnPrimary} onClick={() => setShowAddVehicle(true)}>+ Thêm xe</button>
            </div>

            {loading ? (
              <div className={styles.vcbLoading}>
                <div className={styles.spinner} />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                {/* Stats row */}
                <div className={styles.vcbStatsRow}>
                  <div className={styles.vcbStatCard}>
                    <div className={styles.vcbStatIcon} style={{ background: '#eff6ff' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    </div>
                    <div>
                      <div className={styles.vcbStatValue}>{vehicles.length}</div>
                      <div className={styles.vcbStatLabel}>Xe đã đăng ký</div>
                    </div>
                  </div>
                  <div className={`${styles.vcbStatCard} ${session ? styles.vcbStatCardActive : ''}`}>
                    <div className={styles.vcbStatIcon} style={{ background: session ? '#dcfce7' : '#f0f7ff' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={session ? '#15803d' : '#2d5fd0'} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                    </div>
                    <div>
                      <div className={styles.vcbStatValue}>{session ? 'Đang đỗ' : 'Không'}</div>
                      <div className={styles.vcbStatLabel}>Phiên đỗ hiện tại</div>
                    </div>
                  </div>
                  <div className={styles.vcbStatCard}>
                    <div className={styles.vcbStatIcon} style={{ background: pkg ? '#dcfce7' : '#f0f7ff' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pkg ? '#15803d' : '#2d5fd0'} strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    </div>
                    <div>
                      <div className={styles.vcbStatValue}>{pkg ? daysLeft(pkg.expiryDate) + ' ngày' : 'Chưa có'}</div>
                      <div className={styles.vcbStatLabel}>{pkg ? pkg.planName : 'Gói tháng'}</div>
                    </div>
                  </div>
                </div>

                {/* Active session banner */}
                {session && (
                  <div className={styles.vcbActiveSession}>
                    <div className={styles.vcbActiveLeft}>
                      <div className={styles.vcbActivePlate}>{session.plateNumber}</div>
                      <div className={styles.vcbActiveMeta}>
                        <span className={styles.vcbBadge}>{session.isMonthly ? 'Gói tháng' : 'Vãng lai'}</span>
                        <span className={styles.vcbActiveSlot}>Chỗ {session.slotCode} · {session.floor}</span>
                      </div>
                    </div>
                    <div className={styles.vcbActiveRight}>
                      <div className={styles.vcbActiveTime}>
                        <span className={styles.vcbActiveTimeLabel}>Vào lúc</span>
                        <span className={styles.vcbActiveTimeValue}>{formatTime(session.checkInTime)}</span>
                        <span className={styles.vcbActiveDate}>{formatDate(session.checkInTime)}</span>
                      </div>
                      {!session.isMonthly && session.estimatedAmount != null && (
                        <div className={styles.vcbActiveEst}>
                          <span className={styles.vcbActiveEstLabel}>Ước tính</span>
                          <span className={styles.vcbActiveEstValue}>{formatCurrency(session.estimatedAmount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Package banner */}
                {pkg && (
                  <div className={styles.vcbPackageBanner}>
                    <div className={styles.vcbPkgLeft}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                      <span className={styles.vcbPkgName}>{pkg.planName}</span>
                      <span className={styles.vcbPkgSep}>·</span>
                      <span className={styles.vcbPkgExpiry}>Hết hạn: {formatDate(pkg.expiryDate)}</span>
                    </div>
                    <div className={styles.vcbPkgDays}>
                      <span className={styles.vcbPkgDaysNum}>{daysLeft(pkg.expiryDate)}</span>
                      <span className={styles.vcbPkgDaysLabel}>ngày còn lại</span>
                    </div>
                  </div>
                )}

                {/* Vehicles */}
                <div className={styles.vcbSection}>
                  <h2 className={styles.vcbSectionTitle}>
                    Xe đã đăng ký
                    <span className={styles.vcbSectionCount}>{vehicles.length}</span>
                  </h2>
                  {vehicles.length === 0 ? (
                    <div className={styles.vcbEmpty}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8aacbf" strokeWidth="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                      <p>Bạn chưa đăng ký xe nào.</p>
                      <button className={styles.vcbEmptyBtn} onClick={() => setShowAddVehicle(true)}>Thêm xe ngay</button>
                    </div>
                  ) : (
                    <div className={styles.vcbVehicleList}>
                      {vehicles.map(v => (
                        <div key={v.id} className={styles.vcbVehicleCard}>
                          <div className={styles.vcbVehicleInfo}>
                            <div className={styles.vcbVehicleIcon}>
                              {v.type === 'CAR' ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17H3V9h12l3 8h2"/><path d="M15 9h2l2 4-1 4H11"/></svg>
                              )}
                            </div>
                            <div>
                              <div className={styles.vcbVehiclePlate}>{v.plateNumber}</div>
                              <div className={styles.vcbVehicleType}>
                                {v.type === 'CAR' ? 'Ô tô' : 'Xe máy'}
                                {v.isMonthly && <span className={styles.vcbBadge} style={{ marginLeft: '0.5rem' }}>Gói tháng</span>}
                              </div>
                            </div>
                          </div>
                          <button className={styles.vcbVehicleRemove} onClick={() => handleRemoveVehicle(v.id)} title="Xoá xe">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* History */}
                <div className={styles.vcbSection}>
                  <button className={styles.vcbSectionToggle} onClick={() => setHistoryTab(h => !h)}>
                    <h2 className={styles.vcbSectionTitle} style={{ margin: 0 }}>Lịch sử gửi xe</h2>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: historyTab ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {historyTab && (
                    historyLoading ? (
                      <div className={styles.vcbLoading} style={{ padding: '2rem' }}><div className={styles.spinner} /></div>
                    ) : history.length === 0 ? (
                      <div className={styles.vcbEmpty} style={{ padding: '2rem' }}><p>Chưa có lịch sử gửi xe.</p></div>
                    ) : (
                      <div className={styles.vcbHistoryList}>
                        {history.map(h => (
                          <div key={h.id} className={styles.vcbHistoryItem}>
                            <div className={styles.vcbHistoryLeft}>
                              <div className={styles.vcbHistoryPlate}>{h.plateNumber}</div>
                              <div className={styles.vcbHistoryMeta}>Chỗ {h.slotCode} · {formatDate(h.date)}</div>
                            </div>
                            <div className={styles.vcbHistoryRight}>
                              <div className={styles.vcbHistoryDuration}>{h.duration}</div>
                              <div className={styles.vcbHistoryAmount}>{formatCurrency(h.amount)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add Vehicle Modal ─────────────────────────────── */}
      {showAddVehicle && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowAddVehicle(false); }}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Thêm xe mới</h3>
              <button className={styles.modalClose} onClick={() => setShowAddVehicle(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleAddVehicle} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Biển số xe</label>
                <input className={styles.formInput} type="text" placeholder="VD: 30A-123.45" value={newPlate}
                  onChange={e => setNewPlate(e.target.value.toUpperCase())} maxLength={20} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Loại xe</label>
                <div className={styles.typeSelector}>
                  <button type="button" className={`${styles.typeOption} ${newType === 'CAR' ? styles.typeOptionActive : ''}`} onClick={() => setNewType('CAR')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    Ô tô
                  </button>
                  <button type="button" className={`${styles.typeOption} ${newType === 'MOTORBIKE' ? styles.typeOptionActive : ''}`} onClick={() => setNewType('MOTORBIKE')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17H3V9h12l3 8h2"/><path d="M15 9h2l2 4-1 4H11"/></svg>
                    Xe máy
                  </button>
                </div>
              </div>
              {addError && <div className={styles.formError}>{addError}</div>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnGhost} onClick={() => setShowAddVehicle(false)}>Huỷ</button>
                <button type="submit" className={styles.btnPrimary} disabled={addLoading}>{addLoading ? 'Đang thêm...' : 'Thêm xe'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Footer (home tab only) ─────────────────────────── */}
      {activeTab === 'home' && <Footer navigate={navigate} />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function HeroSection({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>Hệ thống quản lý bãi đỗ xe</span>
          <h1 className={styles.heroTitle}>Giải pháp đỗ xe<br /><span className={styles.titleAccent}>Thông minh &amp; Tối ưu</span></h1>
          <p className={styles.heroSubtitle}>Hệ thống quản lý bãi đỗ xe toàn diện. Đặt chỗ trước, check-in/out bằng mã QR, quản lý trực quan.</p>
          <div className={styles.chips}>
            <span className={styles.chip}>Đặt chỗ trước</span>
            <span className={styles.chip}>Mã QR check-in/out</span>
            <span className={styles.chip}>Báo cáo realtime</span>
          </div>
          <div className={styles.heroCtas}>
            <button className={styles.btnPrimary} onClick={() => navigate('/register')}>Đăng ký ngay</button>
            <button className={styles.btnOutline} onClick={() => navigate('/login')}>Đăng nhập</button>
          </div>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.showcaseCard}>
            <img src="/parking_hero.png" alt="Bãi đỗ xe ParkSmart" className={styles.heroImage} />
          </div>
          <div className={styles.legendCard}>
            <div className={styles.legendTitle}>Khu vực đỗ</div>
            <div className={styles.legendItems}>
              <div className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#2d5fd0' }} /><span>Vãng lai</span></div>
              <div className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#f59e0b' }} /><span>Gói tháng</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Personalised hero for logged-in casual users ──────────
function HeroLoggedIn({
  user,
  session,
  navigate,
}: {
  user: { fullName: string; email: string };
  session: CurrentSession | null;
  navigate: (path: string) => void;
}) {
  const firstName = user.fullName.trim().split(/\s+/)[0] ?? user.email;
  const greeting = getGreeting();
  const title = getTitle(new Date());

  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>
            {greeting === 'Buổi sáng' ? '🌤️' : greeting === 'Buổi chiều' ? '☀️' : '🌙'}
            {' '}{greeting}, {firstName}
          </span>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroSubtitle}>
            {session
              ? `Xe ${session.plateNumber} đang đỗ tại ${session.slotCode} · ${session.floor}. Phí ước tính: ${formatCurrencyInline(session.estimatedAmount ?? 0)}.`
              : 'Chưa có xe nào đang đỗ. Đặt chỗ ngay để giữ chỗ vào bãi!'}
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>{session ? `Đang đỗ: ${session.slotCode}` : 'Chưa đỗ xe'}</span>
            {session?.isMonthly
              ? <span className={`${styles.chip} ${styles.chipGreen}`}>Gói tháng</span>
              : <span className={styles.chip}>Khách vãng lai</span>}
          </div>
          <div className={styles.heroCtas}>
            <button className={styles.btnPrimary} onClick={() => navigate('/login')}>
              {session ? 'Xem chi tiết' : 'Đặt chỗ ngay'}
            </button>
            <button className={styles.btnOutline} onClick={() => navigate('/login')}>
              {session ? 'Thanh toán' : 'Tìm hiểu thêm'}
            </button>
          </div>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.showcaseCard}>
            <img src="/parking_hero.png" alt="Bãi đỗ xe ParkSmart" className={styles.heroImage} />
          </div>
          <div className={styles.legendCard}>
            <div className={styles.legendTitle}>Khu vực đỗ</div>
            <div className={styles.legendItems}>
              <div className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#2d5fd0' }} /><span>Vãng lai</span></div>
              <div className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#f59e0b' }} /><span>Gói tháng</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatCurrencyInline(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function CasualPricingSection({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <span className={styles.eyebrow}>Giá vãng lai</span>
        <h2 className={styles.sectionTitle}>Đỗ xe theo lượt — không cần đăng ký</h2>
        <p className={styles.pricingNote}>Không cần tài khoản. Ra vào nhanh chóng, tính phí theo thời gian thực.</p>
        <div className={styles.cardGrid2}>
          <div className={styles.casualCard}>
            <div className={styles.casualIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            </div>
            <h3 className={styles.casualTitle}>Xe máy</h3>
            <div className={styles.casualTimeBlocks}>
              <div className={styles.timeBlock}>
                <div className={styles.timeBlockLeft}><span className={styles.timeBlockLabel}>Ban ngày</span><span className={styles.timeBlockHours}>06:00 – 17:59</span></div>
                <span className={styles.timeBlockPrice}>3.000đ</span><span className={styles.timeBlockUnit}>/ 4 giờ</span>
              </div>
              <div className={styles.timeBlock}>
                <div className={styles.timeBlockLeft}><span className={styles.timeBlockLabel}>Ban đêm</span><span className={styles.timeBlockHours}>18:00 – 05:59</span></div>
                <span className={styles.timeBlockPrice}>4.000đ</span><span className={styles.timeBlockUnit}>/ 4 giờ</span>
              </div>
            </div>
            <button className={styles.casualBtn} onClick={() => navigate('/login')}>Đặt chỗ ngay</button>
          </div>
          <div className={`${styles.casualCard} ${styles.casualCardFeatured}`}>
            <div className={styles.casualBadge}>Phổ biến</div>
            <div className={styles.casualIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <h3 className={styles.casualTitle}>Ô tô</h3>
            <div className={styles.casualTimeBlocks}>
              <div className={styles.timeBlock}>
                <div className={styles.timeBlockLeft}><span className={styles.timeBlockLabel}>Ban ngày</span><span className={styles.timeBlockHours}>06:00 – 17:59</span></div>
                <span className={styles.timeBlockPrice}>15.000đ</span><span className={styles.timeBlockUnit}>/ 2 giờ</span>
              </div>
              <div className={styles.timeBlock}>
                <div className={styles.timeBlockLeft}><span className={styles.timeBlockLabel}>Buổi tối</span><span className={styles.timeBlockHours}>18:00 – 23:59</span></div>
                <span className={styles.timeBlockPrice}>20.000đ</span><span className={styles.timeBlockUnit}>/ 2 giờ</span>
              </div>
              <div className={`${styles.timeBlock} ${styles.timeBlockNight}`}>
                <div className={styles.timeBlockLeft}><span className={styles.timeBlockLabel}>Đêm muộn</span><span className={styles.timeBlockHours}>00:00 – 05:59</span></div>
                <span className={styles.timeBlockPrice}>100.000đ</span><span className={styles.timeBlockUnit}>trọn đêm</span>
              </div>
            </div>
            <button className={`${styles.casualBtn} ${styles.casualBtnFeatured}`} onClick={() => navigate('/login')}>Đặt chỗ ngay</button>
          </div>
        </div>
        <p className={styles.casualFootnote}>Quá giờ được tính theo block tiếp theo. Vé bị mất: phí 500.000đ.</p>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <span className={styles.eyebrow}>Tính năng nổi bật</span>
        <h2 className={styles.sectionTitle}>Mọi thứ bạn cần để vận hành bãi đỗ</h2>
        <div className={styles.cardGrid3}>
          <FeatureCard num="01" title="Đặt chỗ tự động" desc="Khách vãng lai đặt chỗ trước, hệ thống tự xếp vị trí tối ưu bằng giải thuật Greedy, không cần chọn thủ công." />
          <FeatureCard num="02" title="Check-in/out QR" desc="Quét mã QR tại cổng, vào ra nhanh chóng, quản lý vé thất lạc dễ dàng." />
          <FeatureCard num="03" title="Báo cáo trực quan" desc="Thống kê tỉ lệ lấp đầy, doanh thu, lưu lượng theo thời gian thực." />
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className={styles.sectionAlt}>
      <div className={styles.sectionInner}>
        <span className={styles.eyebrow}>Quy trình vận hành</span>
        <h2 className={styles.sectionTitle}>Ba bước, từ đặt chỗ đến rời bãi</h2>
        <div className={styles.cardGrid3}>
          <ProcessCard num={1} title="Đặt chỗ trực tuyến" desc="Hệ thống tự xếp vị trí tối ưu và giữ chỗ tức thì." />
          <ProcessCard num={2} title="Check-in bằng QR" desc="Quét mã tại cổng, vé điện tử gắn biển số, không vé giấy." />
          <ProcessCard num={3} title="Rời bãi &amp; thanh toán" desc="Phí tính tự động theo thời gian, thanh toán QR." />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureNum}>{num}</div>
      <h3 className={styles.featureCardTitle}>{title}</h3>
      <p className={styles.featureCardDesc}>{desc}</p>
    </div>
  );
}

function ProcessCard({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className={styles.processCard}>
      <div className={styles.stepCircle}>{num}</div>
      <h3 className={styles.processCardTitle}>{title}</h3>
      <p className={styles.processCardDesc}>{desc}</p>
    </div>
  );
}

function PricingSection({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <span className={styles.eyebrow}>Bảng giá gói tháng</span>
        <h2 className={styles.sectionTitle}>Chọn gói phù hợp với bạn</h2>
        <p className={styles.pricingNote}>Giá áp dụng cho ô tô. Xe máy có biểu giá riêng.</p>
        <div className={styles.cardGrid3}>
          <PricingCard title="Gói 1 tháng" duration="30 ngày" price="1.500.000đ" perDay="50.000đ/ngày" perks={['Chỗ đỗ cố định riêng', 'Không tính phí theo lượt', 'Ra vào không giới hạn', 'Ưu tiên khu gói tháng']} icon="calendar" onClick={() => navigate('/login')} />
          <PricingCard title="Gói 3 tháng" duration="90 ngày" price="4.000.000đ" perDay="44.444đ/ngày" perks={['Chỗ đỗ cố định riêng', 'Không tính phí theo lượt', 'Ra vào không giới hạn', 'Ưu tiên khu gói tháng']} icon="check" featured saving="Tiết kiệm ~11%" onClick={() => navigate('/login')} />
          <PricingCard title="Gói 1 năm" duration="365 ngày" price="15.000.000đ" perDay="41.096đ/ngày" perks={['Chỗ đỗ cố định riêng', 'Không tính phí theo lượt', 'Ra vào không giới hạn', 'Ưu tiên khu gói tháng']} icon="star" saving="Tiết kiệm ~17%" onClick={() => navigate('/login')} />
        </div>
      </div>
    </section>
  );
}

function PricingCard({ title, duration, price, perDay, perks, icon, featured, saving, onClick }: {
  title: string; duration: string; price: string; perDay: string; perks: string[];
  icon: string; featured?: boolean; saving?: string; onClick: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    calendar: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    check: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    star: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  };
  return (
    <div className={`${styles.pricingCard} ${featured ? styles.pricingCardFeatured : ''}`}>
      {featured && <div className={styles.pricingBadge}>Tiết kiệm hơn</div>}
      <div className={styles.pricingIcon}>{icons[icon]}</div>
      <div className={styles.pricingHeader}><span className={styles.pricingTier}>{title}</span></div>
      <div className={styles.pricingDuration}>{duration}</div>
      <div className={styles.pricingPrice}>{price}</div>
      <div className={styles.pricingPerDay}>{perDay}</div>
      {saving && <div className={styles.savingTag}>{saving}</div>}
      <ul className={styles.pricingPerks}>{perks.map(p => <li key={p}>{p}</li>)}</ul>
      <button className={`${styles.pricingBtn} ${featured ? styles.pricingBtnFeatured : ''}`} onClick={onClick}>Chọn gói</button>
    </div>
  );
}

function CtaBand({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className={styles.ctaBand}>
      <div className={styles.ctaBandInner}>
        <h2 className={styles.ctaTitle}>Sẵn sàng vận hành bãi đỗ thông minh?</h2>
        <p className={styles.ctaSubtitle}>Bắt đầu miễn phí ngay hôm nay.</p>
        <button className={styles.btnWhite} onClick={() => navigate('/register')}>Đăng ký miễn phí</button>
        <button className={styles.btnWhiteOutline} onClick={() => navigate('/login')}>Đăng nhập</button>
      </div>
    </section>
  );
}

function Footer({ navigate }: { navigate: (path: string) => void }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <div className={styles.logo} onClick={() => navigate('/')}>
            <img src="/logo.png" alt="ParkSmart Logo" className={styles.logoImg} />
            <span className={`${styles.logoText} ${styles.logoTextFooter}`}>Park<span className={styles.logoTextAccent}>Smart</span></span>
          </div>
          <p className={styles.footerTagline}>Giải pháp đỗ xe thông minh &amp; tối ưu.</p>
        </div>
        <div className={styles.footerLinks}>
          <div className={styles.footerCol}><span className={styles.footerColTitle}>Sản phẩm</span><span>Đặt chỗ</span><span>Check-in QR</span><span>Báo cáo</span></div>
          <div className={styles.footerCol}><span className={styles.footerColTitle}>Công ty</span><span>Giới thiệu</span><span>Tuyển dụng</span><span>Liên hệ</span></div>
          <div className={styles.footerCol}><span className={styles.footerColTitle}>Hỗ trợ</span><span>Trung tâm trợ giúp</span><span>Câu hỏi thường gặp</span><span>Liên hệ</span></div>
        </div>
      </div>
      <div className={styles.footerBottom}>&copy; 2026 ParkSmart Vietnam</div>
    </footer>
  );
}
