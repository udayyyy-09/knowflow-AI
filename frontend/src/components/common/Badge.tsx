import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'brand' | 'success' | 'warning' | 'error' | 'neutral' | 'info';
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'brand',
  size = 'md',
  className = '',
  icon,
}) => {
  const variantStyles = {
    brand: 'bg-[rgba(46,111,94,0.1)] text-[#2E6F5E] border-[rgba(46,111,94,0.25)]',
    success: 'bg-[rgba(46,111,94,0.12)] text-[#2E6F5E] border-[rgba(46,111,94,0.25)]',
    warning: 'bg-[rgba(169,119,47,0.12)] text-[#A9772F] border-[rgba(169,119,47,0.3)]',
    error: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-[#ECE9DF] text-[#1B1F27] border-[#DDD9CC]',
    info: 'bg-[rgba(46,111,94,0.08)] text-[#2E6F5E] border-[rgba(46,111,94,0.2)]',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
};
