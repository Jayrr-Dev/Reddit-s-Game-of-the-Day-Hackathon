// ===================================================================
// MENU PANEL
// A sheet that covers the title screen (inside the 512 px post) to show
// one thing at a time: the rules, or today's leaderboard. Closing it
// returns to the menu. The page never scrolls: content too tall for
// the sheet scrolls inside it (faded edges), and Back stays pinned
// below it.
// ===================================================================

import type { ReactNode } from 'react';
import { SCROLL_FADE_STYLE } from '../../../lib/scrollFade';
import { Button } from '../../ui/Button';

// --- TYPES ---
export type MenuPanelProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

// --- COMPONENT ---
/** Renders the sheet with a title, its content and a close button. */
export const MenuPanel = ({ title, onClose, children, wide = false }: MenuPanelProps) => (
  <section
    role="dialog"
    aria-label={title}
    className="run-menu-panel absolute inset-0 z-40 flex flex-col items-center gap-3 overflow-hidden bg-surface p-4 animate-rise"
  >
    <h2 className="font-display text-xl font-black uppercase tracking-widest text-accent">
      {title}
    </h2>
    <div
      className={`flex min-h-0 w-full flex-1 flex-col items-center gap-3 overflow-y-auto overscroll-contain px-1 py-3 ${wide ? 'max-w-3xl' : 'max-w-xs'}`}
      style={wide ? undefined : SCROLL_FADE_STYLE}
    >
      {children}
    </div>
    <Button variant="menu" className="max-w-60" onClick={onClose}>
      Back
    </Button>
  </section>
);
