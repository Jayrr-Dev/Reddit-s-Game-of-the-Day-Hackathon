// ===================================================================
// BUTTON (ATOM)
// The one button style in the app. Variants are data, not new components.
// ===================================================================

import type { ButtonHTMLAttributes } from 'react';

// --- TYPES ---
type ButtonVariant = 'primary' | 'ghost' | 'menu' | 'menuPrimary';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

// --- STYLES ---
const BASE_CLASSES =
  'inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/** Round pill buttons (primary, ghost) and wide title-menu slabs (menu*). */
const MENU_SLAB =
  'oak-menu-button h-9 w-full rounded font-display text-sm font-bold tracking-wide';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'rounded-full px-5 h-10 font-semibold bg-accent text-on-accent hover:bg-accent-hover',
  ghost: 'rounded-full px-5 h-10 font-semibold text-ink-muted hover:text-ink',
  menu: MENU_SLAB,
  menuPrimary: `${MENU_SLAB} oak-menu-primary`,
};

// --- COMPONENT ---
/** Renders a styled button; defaults to type="button" to avoid form submits. */
export const Button = ({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) => (
  <button
    type="button"
    className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`}
    {...props}
  />
);
