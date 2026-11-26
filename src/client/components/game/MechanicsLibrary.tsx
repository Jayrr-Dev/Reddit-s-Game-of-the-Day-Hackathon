// ===================================================================
// MECHANICS LIBRARY (DIALOG)
// Opened from How to Play: every keyword, status and rules term with
// what it does, in tabs. Entries come from MECHANICS_LIBRARY (built on
// the shared GLOSSARY), and each title wears the same icon and colour
// as its tooltip, so the library reads like the chips it explains.
// ===================================================================

import { useState } from 'react';
import {
  MECHANICS_LIBRARY,
  MECHANICS_TAB_LABEL,
  MECHANICS_TABS,
  type MechanicsSection,
} from '../../content/mechanicsLibrary';
import type { GlossaryCategory } from '../../../shared/game/describe';
import { lookOfTerm } from '../../content/glossaryLooks';
import { Button } from '../ui/Button';
import { ModalDialog } from '../ui/ModalDialog';
import { RichText } from '../ui/RichText';
import { TabBar } from '../ui/TabBar';
import { TooltipTitle } from '../ui/Tooltip';

// --- SUBCOMPONENTS ---
/** One section: its heading (if any) over its entries' cards. */
const MechanicsSectionList = ({ section }: { section: MechanicsSection }) => (
  <section className="grid gap-2">
    {section.heading && (
      <h3 className="font-display text-xs font-black uppercase tracking-wider text-accent">
        {section.heading}
      </h3>
    )}
    <dl className="grid gap-2">
      {section.entries.map((entry) => (
        <div key={entry.label} className="rounded-md border border-edge bg-surface-raised px-2.5 py-1.5">
          <dt><TooltipTitle title={entry.label} look={lookOfTerm(entry.label)} /></dt>
          <dd className="mt-0.5 text-[11px] leading-snug"><RichText text={entry.description} /></dd>
        </div>
      ))}
    </dl>
  </section>
);

// --- COMPONENT ---
/** Renders the open library; onClose unmounts it. */
export const MechanicsLibrary = ({ onClose }: { onClose: () => void }) => {
  const [tab, setTab] = useState<GlossaryCategory>('keyword');

  return (
    <ModalDialog
      title="Mechanics"
      isWide
      header={<TabBar ids={MECHANICS_TABS} labels={MECHANICS_TAB_LABEL} tab={tab} onTab={setTab} />}
      onDismiss={onClose}
      actions={
        <Button variant="menuPrimary" className="col-span-2" onClick={onClose} autoFocus>
          Close
        </Button>
      }
    >
      <div className="grid gap-3 pb-1 text-left">
        {MECHANICS_LIBRARY[tab].map((section) => (
          <MechanicsSectionList key={section.heading ?? tab} section={section} />
        ))}
      </div>
    </ModalDialog>
  );
};
