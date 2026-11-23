// ===================================================================
// SCREEN (LAYOUT ATOM)
// Full-height, centered column used by every entrypoint.
// ===================================================================

import type { ReactNode } from 'react';

export type ScreenProps = {
  children: ReactNode;
};

/** Centers its children in a full-height column on the app surface. */
export const Screen = ({ children }: ScreenProps) => (
  <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-4 text-ink">
    {children}
  </main>
);
