import { InputHTMLAttributes, ReactNode } from 'react';

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function InputField({ label, error, icon, ...props }: InputFieldProps) {
  return (
    <div className="input-field">
      {label && <label className="input-label">{label}</label>}
      <div className="input-wrapper">
        {icon && <span className="input-icon">{icon}</span>}
        <input
          className={`input ${error ? 'input--error' : ''}`}
          {...props}
        />
      </div>
      {error && <p className="input-error">{error}</p>}
    </div>
  );
}
