import type { ParkingSlot } from '../types';

interface SlotCardProps {
  slot: ParkingSlot;
  onClick?: (slot: ParkingSlot) => void;
  selected?: boolean;
}

export function SlotCard({ slot, onClick, selected }: SlotCardProps) {
  const colorMap: Record<string, string> = {
    AVAILABLE: '#2ecc71',
    OCCUPIED: '#e74c3c',
    RESERVED: '#f39c12',
  };

  return (
    <div
      onClick={() => onClick?.(slot)}
      style={{
        padding: '0.5rem',
        border: `2px solid ${selected ? '#0f3460' : '#ddd'}`,
        borderRadius: '6px',
        background: selected ? '#f0f0f0' : '#fff',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'center',
        minWidth: '60px',
      }}
    >
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{slot.code}</div>
      <div
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: colorMap[slot.status],
          margin: '4px auto 0',
        }}
      />
      <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>{slot.type}</div>
    </div>
  );
}
