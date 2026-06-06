import { SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDownIcon } from './Icons';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({
  label,
  error,
  icon,
  options,
  placeholder = 'Select option',
  ...props
}: SelectFieldProps) {
  return (
    <div className="input-field">
      {label && <label className="input-label">{label}</label>}
      <div className="input-wrapper">
        {icon && <span className="input-icon">{icon}</span>}
        <select
          className={`input input--select ${error ? 'input--error' : ''}`}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="select-arrow">
          <ChevronDownIcon size={14} />
        </span>
      </div>
      {error && <p className="input-error">{error}</p>}
    </div>
  );
}
