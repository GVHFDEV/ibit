import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export default function LoadingSpinner({ size = 'md', fullScreen = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4'
  };

  const spinner = (
    <div className={`${sizeClasses[size]} border-[#ff7f00] border-t-transparent rounded-full animate-spin`} />
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        {spinner}
      </div>
    );
  }

  return spinner;
}
