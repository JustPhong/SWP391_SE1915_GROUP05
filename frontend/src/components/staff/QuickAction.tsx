import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validatePlate, normalize } from '../../utils/plate';
import styles from '../../styles/staff.module.css';

interface QuickActionProps {
  onCheckIn?: (plate: string) => void;
  onCheckOut?: (plate: string) => void;
}

export function QuickAction({ onCheckIn, onCheckOut }: QuickActionProps) {
  const [plate, setPlate] = useState('');
  const [plateError, setPlateError] = useState('');
  const navigate = useNavigate();

  const handleCheckIn = () => {
    if (!plate.trim()) {
      setPlateError('Vui lòng nhập biển số xe.');
      return;
    }
    const result = validatePlate(plate, 'ALL');
    if (!result.valid) {
      setPlateError(result.message!);
      return;
    }
    const normalized = normalize(plate).replace(/[-.\s]/g, '');
    if (onCheckIn) {
      onCheckIn(normalized);
    } else {
      navigate('/staff/checkin', { state: { plate: normalized } });
    }
  };

  const handleCheckOut = () => {
    if (!plate.trim()) {
      setPlateError('Vui lòng nhập biển số xe.');
      return;
    }
    const result = validatePlate(plate, 'ALL');
    if (!result.valid) {
      setPlateError(result.message!);
      return;
    }
    const normalized = normalize(plate).replace(/[-.\s]/g, '');
    if (onCheckOut) {
      onCheckOut(normalized);
    } else {
      navigate('/staff/checkout', { state: { plate: normalized } });
    }
  };

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Xử lý nhanh</p>

      <div className={styles.quickSearchRow}>
        <input
          type="text"
          className={styles.quickSearchInput}
          style={{ borderColor: plateError ? '#DC2626' : undefined }}
          placeholder="Biển số xe (VD: 51A-123.45)"
          value={plate}
          onChange={(e) => {
            setPlate(e.target.value.toUpperCase());
            if (plateError) setPlateError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCheckIn();
          }}
        />
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          style={{ flexShrink: 0 }}
        >
          <SearchIcon />
        </button>
      </div>
      {plateError && (
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#DC2626' }}>
          {plateError}
        </p>
      )}

      <div className={styles.quickActionBtns}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleCheckIn}
          disabled={!plate.trim()}
        >
          Check-in
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={handleCheckOut}
          disabled={!plate.trim()}
        >
          Check-out
        </button>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
