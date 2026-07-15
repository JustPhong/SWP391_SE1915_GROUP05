import { useState, useCallback, useEffect } from 'react';

export interface CheckoutFormData {
  ticketId: string;
  vehicleInfo: {
    plate: string;
    vehicleType: 'CAR' | 'MOTORBIKE';
    slotCode: string;
    checkInTime: string;
    isMonthly: boolean;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
    seats?: number | null;
    ownerName?: string | null;
    ownerPhone?: string | null;
    ownerEmail?: string | null;
  };
  checkoutPhotos: { front: string | null; back: string | null };
  paymentInfo: { method: 'CASH' | 'CARD' | 'EWALLET'; amount: number; feeBreakdown?: any[] };
}

export default function CheckoutWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CheckoutFormData | null>(null);
  const [done, setDone] = useState(false);

  const go = useCallback((s: number) => setStep(s), []);
  const start = useCallback((d: CheckoutFormData) => { setForm(d); setStep(2); }, []);
  const finish = useCallback(() => setDone(true), []);
  const reset = useCallback(() => { setForm(null); setStep(1); setDone(false); }, []);

  if (done && form) {
    return (
      <div style={{ background:'#fff', borderRadius:18, padding:'1.25rem 1.5rem', boxShadow:'0 8px 32px rgba(30,58,95,0.08)' }}>
        <div style={{ textAlign:'center', marginBottom:'1rem' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p style={{ margin:0, fontSize:'1.1rem', fontWeight:800, color:'#111827' }}>Hoàn tất check-out</p>
        </div>
        <div style={{ background:'#F3F4F6', borderRadius:12, padding:'0.85rem 1rem', marginBottom:'1rem' }}>
          <SummaryRow label="Biển số" value={form.vehicleInfo.plate} />
          <SummaryRow label="Vị trí" value={form.vehicleInfo.slotCode} />
          <SummaryRow label="Giờ vào" value={fmtDT(form.vehicleInfo.checkInTime)} />
          <SummaryRow label="Giờ ra" value={fmtDT(new Date())} />
          <SummaryRow label="Loại" value={form.vehicleInfo.isMonthly ? 'Khách tháng':'Khách lẻ'} />
          <SummaryRow label="Phương thức" value={form.paymentInfo.method === 'CASH' ? 'Tiền mặt' : form.paymentInfo.method === 'CARD' ? 'Thẻ' : 'Ví điện tử'} />
          <div style={{ display:'flex', justifyContent:'space-between', padding:'0.6rem 0', borderTop:'2px solid #E5E7EB', marginTop:'0.25rem' }}>
            <span style={{ fontSize:'0.9rem', fontWeight:800 }}>Tổng phí</span>
            <span style={{ fontSize:'1.05rem', fontWeight:800, color:'#DC2626' }}>{fmtCur(form.paymentInfo.amount)}</span>
          </div>
        </div>
        <button onClick={reset} style={{ width:'100%', padding:'0.75rem', background:'#0B2F6B', color:'#fff', border:'none', borderRadius:12, fontSize:'0.9rem', fontWeight:700, cursor:'pointer' }}>Check-out xe mới</button>
      </div>
    );
  }

  return (
    <div style={{ width:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.25rem', fontSize:'0.85rem' }}>
        {['Tìm xe','Xác nhận & Chụp ảnh','Thanh toán','Hoàn tất'].map((label, i) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            {i>0 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>}
            <span style={{ fontWeight: step===i+1?800:500, color: step===i+1?'#0B2F6B':'#64748B' }}>{label}</span>
          </div>
        ))}
      </div>
      {step===1 && <Step1 onNext={start} />}
      {step===2 && form && <Step2 data={form} onNext={go} onUpdate={setForm} />}
      {step===3 && form && <Step3 data={form} onNext={go} onFinish={finish} onUpdate={setForm} />}
      {step===4 && form && !done && <Step4 data={form} onBack={reset} onComplete={finish} />}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function Step1({ onNext }: { onNext: (d: CheckoutFormData) => void }) {
  const [plate, setPlate] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [parked, setParked] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/checkout/parked', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(j => { if (j.success) setParked(j.data || []); }).catch(() => {});
  }, []);

  const search = async () => {
    if (!plate.trim()) return;
    setSearching(true); setError('');
    try {
      const t = localStorage.getItem('token');
      const r = await fetch(`/api/checkout/lookup?plate=${encodeURIComponent(plate.trim())}`, { headers: { Authorization: `Bearer ${t}` } });
      const j = await r.json();
      if (!j.success || !j.data?.found) { setError(`Không tìm thấy xe "${plate.trim()}" trong bãi đỗ.`); return; }
      const d = j.data;
      onNext({ ticketId: d.recordId, vehicleInfo: { plate: d.plate, vehicleType: d.vehicleType, slotCode: d.slotCode, checkInTime: d.checkInTime, isMonthly: d.isMonthly, brand: d.brand, model: d.model, color: d.color, year: d.year, seats: d.seats, ownerName: d.ownerName, ownerPhone: d.ownerPhone, ownerEmail: d.ownerEmail }, checkoutPhotos: { front: null, back: null }, paymentInfo: { method: 'CASH', amount: d.fee || 0, feeBreakdown: d.breakdown } });
    } catch { setError('Tra cứu thất bại.'); } finally { setSearching(false); }
  };

  return (
    <Card title="Tìm xe">
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem' }}>
        <input value={plate} onChange={e => { setPlate(e.target.value.toUpperCase()); setError(''); }} onKeyDown={e => e.key === 'Enter' && search()} placeholder="51A-11111" style={{ flex:1, padding:'0.65rem 0.85rem', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:'0.9rem', fontWeight:600, fontFamily:"'Consolas','Courier New',monospace" }} />
        <button onClick={search} disabled={!plate.trim() || searching} style={{ padding:'0.65rem 1.25rem', background: plate.trim() && !searching ? '#0B2F6B':'#E5E7EB', color: plate.trim() && !searching ? '#fff':'#9CA3AF', border:'none', borderRadius:10, fontSize:'0.85rem', fontWeight:700, cursor: plate.trim() && !searching ? 'pointer':'not-allowed' }}>{searching ? 'Đang tìm...':'Tìm xe'}</button>
      </div>
      {!!error && <div style={{ background:'#FEE2E2', border:'1.5px solid #FECACA', borderRadius:8, padding:'0.5rem 0.75rem', marginBottom:'0.75rem', color:'#DC2626', fontSize:'0.82rem' }}>{error}</div>}
      {!!parked.length && (
        <div>
          <p style={{ margin:'0 0 0.5rem', fontSize:'0.82rem', color:'#64748B', fontWeight:600 }}>Xe đang đỗ trong bãi</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:240, overflowY:'auto' }}>
            {parked.map((p: any, i: number) => (
              <button key={i} onClick={() => onNext({ ticketId: p.recordId || p.id, vehicleInfo: { plate: p.plate || p.vehicleInfo?.plate, vehicleType: p.vehicleType || p.vehicleInfo?.vehicleType || 'CAR', slotCode: p.slotCode || p.vehicleInfo?.slotCode, checkInTime: p.checkInTime || p.vehicleInfo?.checkInTime || new Date().toISOString(), isMonthly: p.isMonthly || p.vehicleInfo?.isMonthly || false }, checkoutPhotos: { front: null, back: null }, paymentInfo: { method: 'CASH', amount: 0 } })} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.6rem 0.85rem', background:'#F9FAFB', border:'1.5px solid #E5E7EB', borderRadius:10, cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontFamily:"'Consolas','Courier New',monospace", fontWeight:700, color:'#0B2F6B' }}>{p.plate || p.vehicleInfo?.plate}</span>
                <span style={{ fontSize:'0.78rem', color:'#64748B' }}>{p.slotCode || p.vehicleInfo?.slotCode} · {p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' }) : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Step2({ data, onNext, onUpdate }: { data: CheckoutFormData; onNext: (s: number) => void; onUpdate: (f: CheckoutFormData) => void }) {
  const [photos, setPhotos] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const [lostOpen, setLostOpen] = useState(false);
  const [lostForm, setLostForm] = useState({ fullName: '', phone: '', email: '', driverLicense: '', cccd: '', method: 'CASH' as 'CASH'|'CARD'|'EWALLET' });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, which: 'front' | 'back') => {
    const f = e.target.files?.[0]; if (!f) return;
    const b64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(f); });
    setPhotos(p => ({ ...p, [which]: b64 }));
  };

  const penaltyFee = data.vehicleInfo.vehicleType === 'CAR' ? 180000 : 80000;

  const submitLost = async () => {
    if (!lostForm.fullName.trim() || !lostForm.driverLicense.trim() || !lostForm.cccd.trim()) {
      alert('Vui lòng nhập họ tên, bằng lái và CCCD.');
      return;
    }
    const t = localStorage.getItem('token');
    const r = await fetch('/api/checkout/lost-ticket', { method:'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${t}` }, body: JSON.stringify({ plate: data.vehicleInfo.plate, method: lostForm.method }) });
    const j = await r.json();
    if (j.success) {
      alert(`Đã xử lý mất thẻ.\nPhí gửi: ${fmtCur(j.data?.fee ?? 0)}\nPhí phạt mất thẻ: ${fmtCur(penaltyFee)}\nTổng: ${fmtCur((j.data?.fee ?? 0) + penaltyFee)}`);
      setLostOpen(false);
      onNext(4);
    } else {
      alert(j.message || 'Xử lý thất bại');
    }
  };

  return (
    <Card title="Xác nhận & Chụp ảnh">
      <div style={{ background:'#F3F4F6', borderRadius:12, padding:'0.85rem 1rem', marginBottom:'1rem' }}>
        <InfoRow a="Biển số" b={data.vehicleInfo.plate} />
        <InfoRow a="Vị trí" b={data.vehicleInfo.slotCode} />
        <InfoRow a="Giờ vào" b={fmtDT(data.vehicleInfo.checkInTime)} />
        <InfoRow a="Loại" b={data.vehicleInfo.isMonthly ? 'Khách tháng':'Khách lẻ'} isLast />
      </div>
      <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem' }}>
        <PhotoBox label="Ảnh đầu xe (ra)" photo={photos.front} id="co-f" onChange={e => onFile(e, 'front')} />
        <PhotoBox label="Ảnh đuôi xe (ra)" photo={photos.back} id="co-b" onChange={e => onFile(e, 'back')} />
      </div>
      <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
        <button onClick={() => photos.front && photos.back && (onUpdate({ ...data, checkoutPhotos: photos }), onNext(3))} disabled={!photos.front || !photos.back} style={{ flex:1, padding:'0.75rem', background: (!photos.front || !photos.back) ? '#E5E7EB':'#0B2F6B', color: (!photos.front || !photos.back) ? '#9CA3AF':'#fff', border:'none', borderRadius:12, fontSize:'0.9rem', fontWeight:700, cursor: (!photos.front || !photos.back) ? 'not-allowed':'pointer' }}>Tiếp tục</button>
        <button onClick={() => setLostOpen(true)} style={{ padding:'0.75rem 1rem', background:'#fff', color:'#DC2626', border:'1.5px solid #FECACA', borderRadius:12, fontSize:'0.875rem', fontWeight:700, cursor:'pointer' }}>Mất thẻ</button>
      </div>

      {/* Lost ticket modal */}
      {lostOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(17,24,39,0.45)' }} onClick={() => setLostOpen(false)}>
          <div style={{ background:'#fff', borderRadius:16, padding:'1.5rem', width:480, boxShadow:'0 16px 48px rgba(0,0,0,0.18)', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 1rem', fontSize:'1.05rem', fontWeight:800, color:'#DC2626' }}>Xử lý mất thẻ</h3>
            <p style={{ margin:'0 0 1rem', fontSize:'0.82rem', color:'#6B7280' }}>Loại xe: <strong>{data.vehicleInfo.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'}</strong> · Phí phạt mất thẻ: <strong style={{ color:'#DC2626' }}>{fmtCur(penaltyFee)}</strong></p>

            <div style={{ marginBottom:'0.75rem' }}>
              <label style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.25rem' }}>Họ tên chủ xe *</label>
              <input value={lostForm.fullName} onChange={e => setLostForm(f => ({...f, fullName: e.target.value}))} style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'0.75rem' }}>
              <label style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.25rem' }}>Số điện thoại</label>
              <input value={lostForm.phone} onChange={e => setLostForm(f => ({...f, phone: e.target.value.replace(/\D/g,'').slice(0,10)}))} style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'0.75rem' }}>
              <label style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.25rem' }}>Email</label>
              <input value={lostForm.email} onChange={e => setLostForm(f => ({...f, email: e.target.value}))} style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'0.75rem' }}>
              <label style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.25rem' }}>Số bằng lái xe *</label>
              <input value={lostForm.driverLicense} onChange={e => setLostForm(f => ({...f, driverLicense: e.target.value.toUpperCase()}))} style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:'0.75rem' }}>
              <label style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.25rem' }}>Căn cước công dân *</label>
              <input value={lostForm.cccd} onChange={e => setLostForm(f => ({...f, cccd: e.target.value.replace(/\D/g,'').slice(0,12)}))} style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box', fontFamily:'monospace' }} />
            </div>
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.25rem' }}>Phương thức thanh toán</label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                {(['CASH','CARD','EWALLET'] as const).map(m => (
                  <button key={m} onClick={() => setLostForm(f => ({...f, method: m}))} style={{ flex:1, padding:'0.5rem', background: lostForm.method === m ? '#DC2626':'#fff', color: lostForm.method === m ? '#fff':'#374151', border: lostForm.method === m ? 'none':'1.5px solid #D1D5DB', borderRadius:8, fontSize:'0.78rem', fontWeight:700, cursor:'pointer' }}>{m === 'CASH' ? 'Tiền mặt' : m === 'CARD' ? 'Thẻ' : 'Ví điện tử'}</button>
                ))}
              </div>
            </div>

            <div style={{ background:'#FEF2F2', borderRadius:8, padding:'0.75rem 1rem', marginBottom:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.25rem' }}><span style={{ fontSize:'0.82rem', color:'#6B7280' }}>Phí gửi xe</span><span style={{ fontSize:'0.9rem', fontWeight:700 }}>Tính theo thời gian thực</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.25rem' }}><span style={{ fontSize:'0.82rem', color:'#6B7280' }}>Phí phạt mất thẻ</span><span style={{ fontSize:'0.9rem', fontWeight:700, color:'#DC2626' }}>{fmtCur(penaltyFee)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid #FECACA', paddingTop:'0.25rem' }}><span style={{ fontSize:'0.9rem', fontWeight:800 }}>Tổng dự kiến</span><span style={{ fontSize:'0.9rem', fontWeight:800, color:'#DC2626' }}>{fmtCur(penaltyFee)} + phí gửi</span></div>
            </div>

            <div style={{ display:'flex', gap:'0.75rem' }}>
              <button onClick={submitLost} style={{ flex:1, padding:'0.75rem', background:'#DC2626', color:'#fff', border:'none', borderRadius:12, fontSize:'0.9rem', fontWeight:700, cursor:'pointer' }}>Xác nhận mất thẻ</button>
              <button onClick={() => setLostOpen(false)} style={{ padding:'0.75rem 1.25rem', background:'#fff', color:'#6B7280', border:'1.5px solid #E5E7EB', borderRadius:12, fontSize:'0.875rem', fontWeight:600, cursor:'pointer' }}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Step3({ data, onNext, onUpdate }: { data: CheckoutFormData; onNext: (s: number) => void; onFinish?: () => void; onUpdate: (f: CheckoutFormData) => void }) {
  const [method, setMethod] = useState<'CASH'|'CARD'|'EWALLET'>('CASH');
  const [cardType, setCardType] = useState('VISA');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [walletType, setWalletType] = useState('MOMO');
  const [walletPhone, setWalletPhone] = useState('');
  const [time, setTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [fee, setFee] = useState<number>(data.paymentInfo.amount || 0);
  const [breakdown, setBreakdown] = useState<any[]>(data.paymentInfo.feeBreakdown || []);
  const [processing, setProcessing] = useState(false);
  const [feeError, setFeeError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token');
    fetch(`/api/checkout/calculate-fee/${data.ticketId}`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${t}` }, body:JSON.stringify({ checkOutTime:new Date(time).toISOString() }) })
      .then(r => r.json()).then(j => { if (j.success) { setFee(j.data.fee || 0); setBreakdown(j.data.breakdown || []); setFeeError(''); } else { setFeeError(j.message || ''); } }).catch(() => setFeeError('Lỗi tính phí'));
  }, [time]);

  const confirm = async () => {
    if (method === 'CARD' && (!cardNumber.trim() || !cardName.trim() || !cardExpiry.trim() || !cardCvv.trim())) {
      alert('Vui lòng nhập đầy đủ thông tin thẻ.');
      return;
    }
    if (method === 'EWALLET' && !walletPhone.trim()) {
      alert('Vui lòng nhập số điện thoại ví điện tử.');
      return;
    }
    setProcessing(true);
    try {
      const t = localStorage.getItem('token');
      const r = await fetch(`/api/checkout/complete/${data.ticketId}`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${t}` }, body:JSON.stringify({ method, photos: data.checkoutPhotos }) });
      const j = await r.json();
      if (j.success) {
        const finalFee = j.data?.fee ?? fee;
        onUpdate({ ...data, paymentInfo:{ ...data.paymentInfo, method, amount: finalFee } });
        onNext(4);
      } else {
        const msg = j.message || (j.data?.message) || 'Thanh toán thất bại';
        alert(msg);
      }
    } catch (err) {
      alert('Lỗi kết nối khi thanh toán.');
    } finally { setProcessing(false); }
  };

  return (
    <Card title="Thanh toán">
      <div style={{ background:'#F3F4F6', borderRadius:12, padding:'0.85rem 1rem', marginBottom:'1rem' }}>
        <InfoRow a="Biển số" b={data.vehicleInfo.plate} />
        <InfoRow a="Vị trí" b={data.vehicleInfo.slotCode} />
        <InfoRow a="Giờ vào" b={fmtDT(data.vehicleInfo.checkInTime)} />
        <InfoRow a="Giờ ra" b={<input type="datetime-local" value={time} onChange={e => setTime(e.target.value)} style={{ padding:'0.35rem 0.5rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem' }} />} />
        <InfoRow a="Loại" b={data.vehicleInfo.isMonthly ? 'Khách tháng':'Khách lẻ'} isLast />
      </div>
      <div style={{ marginBottom:'1rem' }}>
        <p style={{ margin:'0 0 0.5rem', fontSize:'0.75rem', fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em' }}>Chi tiết phí</p>
        {feeError && <div style={{ color:'#DC2626', fontSize:'0.82rem', marginBottom:'0.5rem' }}>{feeError}</div>}
        {breakdown.map((b: any, i: number) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'0.35rem 0', borderBottom:'1px solid #F3F4F6' }}><span style={{ fontSize:'0.82rem', color:'#6B7280' }}>{b.label}</span><span style={{ fontSize:'0.88rem', fontWeight:700 }}>{fmtCur(b.amount)}</span></div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'0.6rem 0', borderTop:'2px solid #E5E7EB', marginTop:'0.25rem' }}><span style={{ fontSize:'0.9rem', fontWeight:800 }}>Tổng cộng</span><span style={{ fontSize:'1.05rem', fontWeight:800, color:'#DC2626' }}>{fmtCur(fee)}</span></div>
      </div>
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
        {(['CASH','CARD','EWALLET'] as const).map(m => (
          <button key={m} onClick={() => setMethod(m)} style={{ flex:1, padding:'0.6rem', background: method === m ? '#0B2F6B':'#fff', color: method === m ? '#fff':'#111827', border: method === m ? 'none':'1.5px solid #E5E7EB', borderRadius:10, fontSize:'0.85rem', fontWeight:700, cursor:'pointer' }}>{m === 'CASH' ? 'Tiền mặt' : m === 'CARD' ? 'Thẻ' : 'Ví điện tử'}</button>
        ))}
      </div>

      {/* Card details */}
      {method === 'CARD' && (
        <div style={{ background:'#F9FAFB', borderRadius:12, padding:'1rem', marginBottom:'1rem', border:'1px solid #E5E7EB' }}>
          <p style={{ margin:'0 0 0.75rem', fontSize:'0.82rem', fontWeight:700, color:'#374151' }}>Thông tin thẻ</p>
          <div style={{ marginBottom:'0.75rem' }}>
            <label style={{ fontSize:'0.78rem', fontWeight:600, color:'#6B7280', display:'block', marginBottom:'0.25rem' }}>Loại thẻ</label>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              {['VISA','MASTERCARD','JCB','ATM'].map(t => (
                <button key={t} onClick={() => setCardType(t)} style={{ padding:'0.4rem 0.75rem', background: cardType === t ? '#0B2F6B':'#fff', color: cardType === t ? '#fff':'#374151', border: cardType === t ? 'none':'1.5px solid #D1D5DB', borderRadius:8, fontSize:'0.78rem', fontWeight:700, cursor:'pointer' }}>{t}</button>
              ))}
            </div>
          </div>
          <input value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/\D/g,'').slice(0,16))} placeholder="Số thẻ" style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', marginBottom:'0.5rem', boxSizing:'border-box', fontFamily:'monospace' }} />
          <input value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} placeholder="Tên chủ thẻ" style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', marginBottom:'0.5rem', boxSizing:'border-box' }} />
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <input value={cardExpiry} onChange={e => setCardExpiry(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="MM/YY" maxLength={5} style={{ flex:1, padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box', fontFamily:'monospace' }} />
            <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g,'').slice(0,3))} placeholder="CVV" maxLength={3} style={{ flex:1, padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box', fontFamily:'monospace' }} />
          </div>
        </div>
      )}

      {/* eWallet details */}
      {method === 'EWALLET' && (
        <div style={{ background:'#F9FAFB', borderRadius:12, padding:'1rem', marginBottom:'1rem', border:'1px solid #E5E7EB' }}>
          <p style={{ margin:'0 0 0.75rem', fontSize:'0.82rem', fontWeight:700, color:'#374151' }}>Chọn ví điện tử</p>
          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem' }}>
            {['MOMO','ZALOPAY','VNPAY','SHOPEEPAY'].map(w => (
              <button key={w} onClick={() => setWalletType(w)} style={{ flex:1, padding:'0.5rem', background: walletType === w ? '#0B2F6B':'#fff', color: walletType === w ? '#fff':'#374151', border: walletType === w ? 'none':'1.5px solid #D1D5DB', borderRadius:8, fontSize:'0.78rem', fontWeight:700, cursor:'pointer' }}>{w}</button>
            ))}
          </div>
          <input value={walletPhone} onChange={e => setWalletPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="Số điện thoại" style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box' }} />
        </div>
      )}

      <button onClick={confirm} disabled={processing} style={{ width:'100%', padding:'0.75rem', background:'#0B2F6B', color:'#fff', border:'none', borderRadius:12, fontSize:'0.9rem', fontWeight:700, cursor:'pointer' }}>{processing ? 'Đang xử lý...':'Xác nhận thanh toán'}</button>
    </Card>
  );
}

function Step4({ data, onBack, onComplete }: { data: CheckoutFormData; onBack: () => void; onComplete: () => void }) {
  return (
    <div style={{ background:'#fff', borderRadius:18, padding:'1.25rem 1.5rem', boxShadow:'0 8px 32px rgba(30,58,95,0.08)', marginTop:'0.75rem' }}>
      <div style={{ textAlign:'center', marginBottom:'1rem' }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <p style={{ margin:0, fontSize:'1.1rem', fontWeight:800, color:'#111827' }}>Hoàn tất check-out</p>
      </div>
      <div style={{ background:'#F3F4F6', borderRadius:12, padding:'0.85rem 1rem', marginBottom:'1rem' }}>
        <InfoRow a="Biển số" b={data.vehicleInfo.plate} />
        <InfoRow a="Vị trí" b={data.vehicleInfo.slotCode} />
        <InfoRow a="Giờ vào" b={fmtDT(data.vehicleInfo.checkInTime)} />
        <InfoRow a="Giờ ra" b={fmtDT(new Date())} />
        <InfoRow a="Loại" b={data.vehicleInfo.isMonthly ? 'Khách tháng':'Khách lẻ'} />
        <InfoRow a="Phương thức" b={data.paymentInfo.method === 'CASH' ? 'Tiền mặt' : data.paymentInfo.method === 'CARD' ? 'Thẻ' : 'Ví điện tử'} isLast />
        <div style={{ display:'flex', justifyContent:'space-between', padding:'0.6rem 0', borderTop:'2px solid #E5E7EB', marginTop:'0.25rem' }}>
          <span style={{ fontSize:'0.9rem', fontWeight:800 }}>Tổng phí</span>
          <span style={{ fontSize:'1.05rem', fontWeight:800, color:'#DC2626' }}>{fmtCur(data.paymentInfo.amount)}</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:'0.5rem' }}>
        <button onClick={onBack} style={{ flex:1, padding:'0.75rem', background:'#0B2F6B', color:'#fff', border:'none', borderRadius:12, fontSize:'0.9rem', fontWeight:700, cursor:'pointer' }}>Check-out xe mới</button>
        <button onClick={onComplete} style={{ flex:1, padding:'0.75rem', background:'#16A34A', color:'#fff', border:'none', borderRadius:12, fontSize:'0.9rem', fontWeight:700, cursor:'pointer' }}>Hoàn tất</button>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:'#fff', borderRadius:18, padding:'1.25rem 1.5rem', marginBottom:'0.75rem', boxShadow:'0 8px 32px rgba(30,58,95,0.08)' }}>
      <p style={{ margin:'0 0 1rem', fontSize:'0.95rem', fontWeight:700, color:'#111827' }}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ a, b, isLast }: { a: string; b: React.ReactNode; isLast?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'0.4rem 0', borderBottom: isLast ? 'none' : '1px solid #E5E7EB' }}>
      <span style={{ fontSize:'0.82rem', color:'#6B7280' }}>{a}</span>
      <span style={{ fontSize:'0.88rem', fontWeight:700, color:'#111827' }}>{b}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'0.4rem 0', borderBottom:'1px solid #E5E7EB' }}>
      <span style={{ fontSize:'0.82rem', color:'#6B7280' }}>{label}</span>
      <span style={{ fontSize:'0.88rem', fontWeight:700, color:'#111827' }}>{value}</span>
    </div>
  );
}

function PhotoBox({ label, photo, id, onChange }: { label: string; photo: string | null; id: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div style={{ flex:1 }}>
      <p style={{ margin:'0 0 0.5rem', fontSize:'0.75rem', fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label} *</p>
      <input type="file" accept="image/*" id={id} onChange={onChange} style={{ display:'none' }} />
      <button onClick={() => (document.getElementById(id) as HTMLInputElement)?.click()} style={{ width:'100%', padding:'0.6rem', border:'1.5px dashed #D1D5DB', borderRadius:10, background: photo ? '#ECFDF5':'#F9FAFB', fontSize:'0.85rem', fontWeight:700, cursor:'pointer' }}>{photo ? 'Đã chụp':'Chụp ảnh'}</button>
      {photo && <img src={photo} style={{ width:'100%', marginTop:'0.5rem', borderRadius:10, maxHeight:160, objectFit:'cover' }} />}
    </div>
  );
}

function fmtCur(v: number) { return new Intl.NumberFormat('vi-VN').format(v) + ' đ'; }
function fmtDT(i: string | Date | null | undefined) {
  if (!i) return '';
  const d = new Date(i);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}