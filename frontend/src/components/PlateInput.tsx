import React, { useRef, useEffect } from 'react';
import { formatPlateNumber } from '../utils/plate';

interface PlateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (val: string) => void;
  vehicleType?: 'CAR' | 'MOTORBIKE';
}

export const PlateInput: React.FC<PlateInputProps> = ({ value, onChange, vehicleType, ...props }) => {
  const isComposing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync value if changed from outside
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value && !isComposing.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (isComposing.current) {
      // Update state with raw value to keep it in sync, but do NOT format
      // the DOM value yet to prevent interrupting the IME.
      onChange(rawVal);
      return;
    }
    const formatted = formatPlateNumber(rawVal, value, vehicleType);
    if (inputRef.current) {
      inputRef.current.value = formatted;
    }
    onChange(formatted);
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposing.current = false;
    const rawVal = e.currentTarget.value;
    const formatted = formatPlateNumber(rawVal, value, vehicleType);
    if (inputRef.current) {
      inputRef.current.value = formatted;
    }
    onChange(formatted);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      {...props}
    />
  );
};
