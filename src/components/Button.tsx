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
  const baseStyles = "relative flex items-center justify-center font-bold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  
  const variants = {
    primary: "btn-neumorph-primary",
    secondary: "btn-neumorph",
    outline: "border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white rounded-full px-6 py-2",
    ghost: "text-[var(--text-secondary)] hover:text-[var(--accent)] rounded-lg",
    icon: "btn-neumorph rounded-full aspect-square p-3",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
    icon: "p-3",
  };

  return (
    <button 
      className={cn(
        baseStyles,
        variant !== 'outline' && variant !== 'ghost' ? variants[variant] : '',
        variant === 'outline' || variant === 'ghost' ? variants[variant] : '',
        size !== 'icon' && variant !== 'outline' && variant !== 'ghost' ? sizes[size] : '',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
