import { useState } from 'react';
import portrait from '../../assets/table/portrait.webp';
import type { RunAction, RunState } from '../../../shared/game/run';
import { useGameSettings } from '../../hooks/useGameSettings';
import { MenuBackButton } from '../ui/MenuBackButton';
import { Glyph } from '../ui/Glyph';
import { ProgressiveImg } from '../ui/ProgressiveImage';
import { BattleCharacterSheet } from './BattleCharacterSheet';
import { SettingsDialog } from './menu/SettingsDialog';
import { MapExpandButton } from './MapExpandButton';
import type { MapHandoff } from '../../lib/mapExpansion';

export type AtlasRunControls = {
  run: Pick<RunState, 'character' | 'hp' | 'maxHp' | 'deck' | 'artifacts' | 'conquestVersion'>;
  onAction: (action: RunAction) => void;
  onMainMenu: () => void;
};

/** The map portrait doubles as the entry to the active run's profile. */
export function AtlasPlayerControls({ run, onAction, onMainMenu }: AtlasRunControls) {
  const [profile, setProfile] = useState(false);
  return <>
    <nav className="atlas-main-controls" aria-label="Conquest controls">
      <MenuBackButton className="atlas-menu-back" onClick={onMainMenu} />
      <button type="button" className="atlas-profile" aria-label="Open profile" aria-haspopup="dialog"
        onClick={() => setProfile(true)}>
        <ProgressiveImg className="atlas-profile-portrait" src={portrait} alt="" />
        <span>
          <strong>Profile</strong>
          <small><span>Lv. {run.character.level}</span><span className="atlas-profile-vitals"><Glyph name="heart" className="atlas-profile-heart" />{run.hp}/{run.maxHp} HP</span></small>
        </span>
      </button>
    </nav>
    {profile && <BattleCharacterSheet
      deck={run.deck} artifacts={run.artifacts} character={run.character} vitals={{ hp: run.hp, maxHp: run.maxHp }}
      onAction={onAction} onClose={() => setProfile(false)}
    />}
  </>;
}

/** Reuses the same preferences as battle without abandoning the conquest. */
export function AtlasSettings({ view, className = 'atlas-settings-gear' }: { view?: MapHandoff | undefined; className?: string }) {
  const { controls } = useGameSettings();
  return <SettingsDialog className={className}>
    <MapExpandButton view={view} />
    {controls}
  </SettingsDialog>;
}
