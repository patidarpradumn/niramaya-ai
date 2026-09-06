import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', padding = 'md', hover = false, onClick }: CardProps) {
  const padMap = { none: '', sm: 'p-3', md: 'p-4 lg:p-5', lg: 'p-5 lg:p-6' };
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ${padMap[padding]} ${
        hover ? 'hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-gray-300 transition-all duration-200' : ''
      } ${onClick ? 'cursor-pointer' : 'cursor-default'} ${className}`}
    >
      {children}
    </div>
  );
}
