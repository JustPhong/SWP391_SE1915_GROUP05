import { useState } from 'react';
import { LockIcon, EyeIcon, EyeOffIcon } from './Icons';

interface PasswordInputProps {
  label?: string;
  error?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  id?: string;
  name?: string;
}

export function PasswordInput({
  label,
  error,
  value,
  onChange,
  placeholder = 'Enter password',
  id,
  name,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="input-field">
      {label && <label className="input-label">{label}</label>}
      <div className="input-wrapper">
        <span className="input-icon">
          <LockIcon size={15} />
        </span>
        <input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`input ${error ? 'input--error' : ''}`}
        />
        <button
          type="button"
          className="input-toggle"
          onClick={() => setShow(!show)}
          tabIndex={-1}
        >
          {show ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
        </button>
      </div>
      {error && <p className="input-error">{error}</p>}
    </div>
  );
}
