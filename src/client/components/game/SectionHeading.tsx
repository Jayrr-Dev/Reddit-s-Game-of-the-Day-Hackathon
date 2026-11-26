// ===================================================================
// SECTION HEADING
// A full-width heading that starts a section of an entry grid (the
// training picker's tabs and the admin Dev panel share it).
// ===================================================================

import type { ReactNode } from 'react';

// --- COMPONENT ---
/** Renders the heading across every column of its grid. */
export const SectionHeading = ({ children }: { children: ReactNode }) => (
  <h3 className="col-span-full mt-1 text-xs font-bold uppercase tracking-widest text-[#f2d29b]">
    {children}
  </h3>
);
