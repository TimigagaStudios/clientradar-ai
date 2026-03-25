import React from 'react';
import { cn } from '../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
}

const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold tracking-tight transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variants = {
    primary:
      'btn-neumorph-primary text-white',
    secondary:
      'btn-neumorph text-[var(--text-primary)]',
    outline:
      'rounded-full border border-[var(--surface-border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] shadow-[var(--surface-shadow-soft)]',
    ghost:
      'rounded-xl text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
    icon:
      'rounded-2xl bg-[var(--bg-secondary)] border border-[var(--surface-border-soft)] text-[var(--text-primary)] shadow-[var(--surface-shadow-soft)] hover:text-[var(--accent)]',
  };

  const sizes = {
    sm: 'px-4 py-2.5 text-sm',
    md: 'px-5 py-3 text-sm md:text-base',
    lg: 'px-6 py-3.5 text-base md:text-lg',
    icon: 'p-3',
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
