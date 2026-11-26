// ===================================================================
// LOCKED PREVIEW (ATOM)
// Shows locked content blurred under a padlock, so players get a peek
// at what they can unlock. The content can't be tapped or focused; the
// padlock's tooltip says how to unlock it. Unlocked content renders as is.
// ===================================================================

import type { ReactNode } from 'react';
import { Glyph } from './Glyph';

// --- COMPONENT ---
/** Wraps content in a blurred, inert preview with a padlock when locked. */
export const LockedPreview = ({
  isLocked,
  hint,
  children,
}: {
  isLocked: boolean;
  /** How to unlock it (tooltip and screen reader label). */
  hint: string;
  children: ReactNode;
}) => {
  if (!isLocked) return children;
  return (
    <div className="locked-preview" title={hint}>
      <div className="locked-preview-content" inert aria-hidden="true">
        {children}
      </div>
      <span className="locked-preview-badge" role="img" aria-label={'Locked. ' + hint}>
        <Glyph name="padlock" className="size-5" />
      </span>
    </div>
  );
};
