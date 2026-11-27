import React, { useCallback, useRef } from 'react';
import type { UserRole } from '../../types/app';
import { getRoleTheme } from './roleTheme';

export type GlassSpotlightElement = 'div' | 'section' | 'article' | 'aside' | 'header' | 'button';

export interface GlassSpotlightCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'role'> {
  children: React.ReactNode;
  role?: UserRole | null;
  ariaRole?: React.AriaRole;
  className?: string;
  as?: GlassSpotlightElement;
  interactive?: boolean;
  variant?: 'default' | 'strong' | 'subtle';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const VARIANT_CLASS: Record<NonNullable<GlassSpotlightCardProps['variant']>, string> = {
  default: 'dsb-glass',
  strong: 'dsb-glass-strong',
  subtle: 'dsb-glass-subtle',
};

export const GlassSpotlightCard: React.FC<GlassSpotlightCardProps> = ({
  children,
  role = 'admin',
  ariaRole,
  className = '',
  as = 'div',
  interactive = false,
  variant = 'default',
  style,
  onPointerMove,
  onPointerLeave,
  ...rest
}) => {
  const containerRef = useRef<HTMLElement | null>(null);
  const theme = getRoleTheme(role);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        el.style.setProperty('--spot-x', `${x.toFixed(1)}px`);
        el.style.setProperty('--spot-y', `${y.toFixed(1)}px`);
        el.style.setProperty('--spot-opacity', '1');
      }
      onPointerMove?.(event);
    },
    [onPointerMove],
  );

  const handlePointerLeave = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = containerRef.current;
      if (el) {
        el.style.setProperty('--spot-opacity', '0');
      }
      onPointerLeave?.(event);
    },
    [onPointerLeave],
  );

  const Component = as as React.ElementType;

  return (
    <Component
      ref={containerRef}
      role={ariaRole}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative overflow-hidden ${VARIANT_CLASS[variant]} ${
        interactive
          ? 'transition-all duration-200 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0'
          : ''
      } ${className}`}
      style={{
        ['--spot-color' as string]: theme.spotlightRgba,
        ['--spot-border' as string]: theme.spotlightBorderRgba,
        ...style,
      }}
      {...rest}
    >
      {/* Pointer-tracking radial specular spotlight (CSS-variable driven, zero re-renders) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: 'var(--spot-opacity, 0)',
          background:
            'radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), var(--spot-color), transparent 70%)',
        }}
      />
      {/* Top specular glass glint */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
      />
      <div className="relative z-10">{children}</div>
    </Component>
  );
};
