import * as React from 'react';
import { cn } from '@/utils/cn';

interface ProgressProps {
  value: number;
  className?: string;
  max?: number;
}

export function Progress({ value, className, max = 100 }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('w-full bg-gray-200 rounded-full h-2', className)}>
      <div
        className="bg-primary h-full rounded-full transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

