// ===================================================================
// DEV PANEL
// The admin-only Dev sheet on the title screen: reference tabs that are
// not part of the game (every sound, every effect and icon, and the
// magic circle generator). The menu
// only opens it for admins; nothing here changes saved data.
// ===================================================================

import { useState, type ReactNode } from 'react';
import { MenuPanel } from './MenuPanel';
import { SoundLibrary } from './SoundLibrary';
import { AssetLibrary } from './AssetLibrary';
import { MagicCircleLab } from './MagicCircleLab';
import { TabBar } from '../../ui/TabBar';
import { SectionHeading } from '../SectionHeading';

// --- TYPES ---
type DevTab = 'sounds' | 'assets' | 'circle';

// --- CONSTANTS ---
const DEV_TABS: readonly DevTab[] = ['sounds', 'assets', 'circle'];
const DEV_TAB_LABELS: Record<DevTab, string> = { sounds: 'Sounds', assets: 'Assets', circle: 'Magic Circle' };

/** Each tab's content. */
const DEV_TAB_VIEWS: Record<DevTab, () => ReactNode> = {
  sounds: () => <SoundLibrary renderHeading={renderHeading} />,
  assets: () => <AssetLibrary renderHeading={renderHeading} />,
  circle: () => <MagicCircleLab renderHeading={renderHeading} />,
};

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
        {DEV_TAB_VIEWS[tab]()}
      </div>
    </MenuPanel>
  );
};
