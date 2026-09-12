// ============================================================
// Card — Reusable card container
// ============================================================

import { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'glass' | 'outlined';
  padding?: 'sm' | 'md' | 'lg';
}

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`card card-${variant} card-pad-${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
