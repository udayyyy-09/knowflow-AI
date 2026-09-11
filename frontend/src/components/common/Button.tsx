import React from 'react';
import { Spinner } from '@/components/common/Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#F6F5F0] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer select-none';

  const variantStyles = {
    primary: 'bg-[#1B1F27] hover:bg-[#2E6F5E] text-[#F6F5F0] shadow-sm hover:shadow focus:ring-[#1B1F27]',
    secondary: 'bg-white hover:bg-[#ECE9DF] text-[#1B1F27] border border-[#DDD9CC] hover:border-[#1B1F27] focus:ring-[#1B1F27] shadow-xs',
    outline: 'bg-transparent hover:bg-white text-[#1B1F27] border border-[#DDD9CC] hover:border-[#1B1F27] focus:ring-[#2E6F5E]',
    ghost: 'bg-transparent hover:bg-[#ECE9DF] text-[#5B6270] hover:text-[#1B1F27] focus:ring-[#1B1F27]',
    danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 focus:ring-red-500',
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5 font-semibold',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} className="text-current" /> : icon}
      {children}
    </button>
  );
};
