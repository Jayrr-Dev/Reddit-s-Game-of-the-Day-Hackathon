// ===================================================================
// ICON BUTTON (ATOM)
// A round, icon-only button: the settings gear and the training back
// button share it so banner controls look alike.
// ===================================================================

import type { ButtonHTMLAttributes } from 'react';
import { Glyph, type GlyphName } from './Glyph';

// --- TYPES ---
export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: GlyphName;
  /** Read by screen readers and shown as the hover tooltip, since there is no visible label. */
  label: string;
};

// --- COMPONENT ---
/** Renders one round icon button with an accessible name. */
export const IconButton = ({ icon, label, className = '', ...rest }: IconButtonProps) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={'grid size-10 shrink-0 place-items-center rounded-full border border-accent/35 bg-surface-sunken/85 text-accent hover:border-accent focus-visible:outline-2 focus-visible:outline-accent ' + className}
    {...rest}
  >
    <Glyph name={icon} className="size-5" />
  </button>
);
