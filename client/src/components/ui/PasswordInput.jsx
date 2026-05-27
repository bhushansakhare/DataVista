import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password input with show/hide toggle. Drop-in replacement for
 * <input type="password" />. Forwards every standard input prop.
 */
export default function PasswordInput({ className = 'input', wrapperClassName = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-500 hover:text-ink-700 dark:hover:text-ink-200 transition"
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
