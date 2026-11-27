import type { MouseEventHandler } from 'react';
import { IconButton } from './IconButton';

/** Consistent top-left navigation for menu pages. Keep it inside the page frame. */
export function MenuBackButton({ onClick, disabled, label = 'Back to main menu' }: {
  onClick: MouseEventHandler<HTMLButtonElement>; disabled?: boolean; label?: string;
}) {
  return <IconButton icon="back" label={label} className="absolute left-3 top-3 z-10 menu-icon-hint disabled:opacity-50"
    onClick={onClick} disabled={disabled} />;
}
