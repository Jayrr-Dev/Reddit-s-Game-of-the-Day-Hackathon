import { useState } from 'react';
import portrait from '../../assets/table/portrait.webp';
import type { RunAction, RunState } from '../../../shared/game/run';
import { useGameSettings } from '../../hooks/useGameSettings';
import { Button } from '../ui/Button';
import { Glyph } from '../ui/Glyph';
import { ProgressiveImg } from '../ui/ProgressiveImage';
import { BattleCharacterSheet } from './BattleCharacterSheet';
import { SettingsDialog } from './menu/SettingsDialog';

export type AtlasRunControls = {
  run: Pick<RunState, 'character' | 'hp' | 'maxHp' | 'deck' | 'artifacts' | 'conquestVersion'>;
  onAction: (action: RunAction) => void;
  onMainMenu: () => void;
};

/** The map portrait doubles as the entry to the active run's profile. */
export function AtlasPlayerControls({ run, onAction }: AtlasRunControls) {
  const [profile, setProfile] = useState(false);
  return <>
    <button type="button" className="atlas-profile" aria-label="Open profile" aria-haspopup="dialog"
      onClick={() => setProfile(true)}>
      <ProgressiveImg className="atlas-profile-portrait" src={portrait} alt="" />
      <span>
        <strong>Profile</strong>
        <small>Lv. {run.character.level}<Glyph name="heart" className="atlas-profile-heart" />{run.hp}/{run.maxHp} HP</small>
      </span>
    </button>
    {profile && <BattleCharacterSheet
      deck={run.deck} artifacts={run.artifacts} character={run.character} vitals={{ hp: run.hp, maxHp: run.maxHp }}
      onAction={onAction} onClose={() => setProfile(false)}
    />}
  </>;
}

/** Reuses the same preferences as battle without abandoning the conquest. */
export function AtlasSettings({ onMainMenu }: { onMainMenu: () => void }) {
  const { controls } = useGameSettings();
  return <SettingsDialog className="atlas-settings-gear">
    <Button variant="menu" onClick={onMainMenu}>Return to main menu</Button>
    <p className="text-xs text-ink-muted">You can resume this conquest later.</p>
    {controls}
  </SettingsDialog>;
}
