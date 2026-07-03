import React, { useRef, useEffect } from 'react';
import { formatPlateNumber } from '../utils/plate';

interface PlateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (val: string) => void;
}

export const PlateInput: React.FC<PlateInputProps> = ({ value, onChange, ...props }) => {
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
      // During IME composition (e.g. typing Telex or VNI tone marks),
      // we let the browser handle typing natively without modifying the input value.
      return;
    }
    const formatted = formatPlateNumber(rawVal, value);
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
    const formatted = formatPlateNumber(rawVal, value);
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
