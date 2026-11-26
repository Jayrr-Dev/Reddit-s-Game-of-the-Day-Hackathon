// ===================================================================
// DEV PANEL
// The admin-only Dev sheet on the title screen: reference tabs that are
// not part of the game (every sound, every effect and icon). The menu
// only opens it for admins; nothing here changes saved data.
// ===================================================================

import { useState } from 'react';
import { MenuPanel } from './MenuPanel';
import { SoundLibrary } from './SoundLibrary';
import { AssetLibrary } from './AssetLibrary';
import { TabBar } from '../../ui/TabBar';
import { SectionHeading } from '../SectionHeading';

// --- TYPES ---
type DevTab = 'sounds' | 'assets';

// --- CONSTANTS ---
const DEV_TABS: readonly DevTab[] = ['sounds', 'assets'];
const DEV_TAB_LABELS: Record<DevTab, string> = { sounds: 'Sounds', assets: 'Assets' };

/** Draws a library section's heading. */
const renderHeading = (label: string) => <SectionHeading key={label}>{label}</SectionHeading>;

// --- COMPONENT ---
/** Renders the Dev sheet with its tabs; onClose returns to the menu. */
export const DevPanel = ({ onClose }: { onClose: () => void }) => {
  const [tab, setTab] = useState<DevTab>('sounds');
  return (
    <MenuPanel title="Dev" onClose={onClose} wide>
      <TabBar ids={DEV_TABS} labels={DEV_TAB_LABELS} tab={tab} onTab={setTab} className="w-full" />
      <div key={tab} className="training-entries w-full" role="tabpanel" aria-label={DEV_TAB_LABELS[tab]}>
        {tab === 'sounds' ? <SoundLibrary renderHeading={renderHeading} /> : <AssetLibrary renderHeading={renderHeading} />}
      </div>
    </MenuPanel>
  );
};
