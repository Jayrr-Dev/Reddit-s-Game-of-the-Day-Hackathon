// ===================================================================
// BUTTON (ATOM)
// The one button style in the app. Variants are data, not new components.
// ===================================================================

import type { ButtonHTMLAttributes } from 'react';

// --- TYPES ---
type ButtonVariant = 'primary' | 'ghost';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

// --- STYLES ---
const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-full px-5 h-10 font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  ghost: 'text-ink-muted hover:text-ink',
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
