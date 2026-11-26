import { useEffect, useState } from 'react';
import { type RingProgress } from '../../../shared/game/character';
import {
  characterEdit,
  type PlayerBuild,
} from '../../../shared/game/playerBuild';
import {
  createRun,
  runReducer,
  type RunAction,
} from '../../../shared/game/run';
import {
  starterDeck,
  starterNames,
  validStarter,
} from '../../../shared/game/starters';
import type { InitResponse } from '../../../shared/types/api';
import { getItem, itemQuantity, RESPEC_ITEM } from '../../../shared/game/items';
import { usePlayerItems } from '../../hooks/usePlayerItems';
import { apiClient } from '../../lib/apiClient';
import { localBuild, storeBuild } from '../../lib/playerBuild';
import { Button } from '../ui/Button';
import { ProfileDeck, ProfileStrip } from './profileParts';
import { InventoryPanel } from './inventory/InventoryPanel';
import type { InventorySlot } from '../../../shared/game/inventory';
import { RunCharacterSheet } from './RunCharacterSheet';

export function ProfileView({
  data,
  rings,
  onClose,
}: {
  data: InitResponse;
  rings?: RingProgress | undefined;
  onClose: () => void;
}) {
  const [build, setBuild] = useState<PlayerBuild>(() =>
    localBuild(data.accountId)
  );
  const [wins, setWins] = useState(data.lifetimeWins ?? 0);
  const [loading, setLoading] = useState(!!data.accountId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const { items, setItems, spend, discard } = usePlayerItems(data.accountId);
  useEffect(() => {
    if (!data.accountId) return;
    let live = true;
    setLoading(true);
    setLoadError(false);
    setError('');
    apiClient
      .profile()
      .then((result) => {
        if (live) {
          setBuild(result.build);
          setWins(result.wins);
          setItems(result.items);
        }
      })
      .catch(() => {
        if (live) {
          setError('Your profile could not be loaded.');
          setLoadError(true);
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [data.accountId, retry, setItems]);
  const run = build.character.reduce(
    runReducer,
    createRun(data.dailyKey, rings, 0, wins)
  );
  const character = run.character;
  const name = build.selected;
  const cards = build.decks[name] ?? starterDeck(name);
  const valid = validStarter(name, cards);
  const decksValid = Object.entries(build.decks).every(([key, deck]) =>
    starterNames.some((style) => style === key && validStarter(style, deck))
  );
  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      if (data.accountId) await apiClient.saveProfile(build);
      else storeBuild(build);
      onClose();
    } catch {
      setError('Could not save your changes. Try again.');
    } finally {
      setSaving(false);
    }
  }
  function changeCharacter(action: RunAction) {
    if (!characterEdit(action)) return;
    setBuild((previous) => {
      const current = previous.character.reduce(
        runReducer,
        createRun(data.dailyKey, rings, 0, wins)
      );
      return runReducer(current, action) === current
        ? previous
        : { ...previous, character: [...previous.character, action] };
    });
  }
  /** Spends a Tome of Regret (free for admins, checked by the server), then refunds every trait node. */
  async function respec() {
    setError('');
    if (!(await spend(RESPEC_ITEM)))
      return setError(`Could not use the ${itemName}. Try again.`);
    setBuild((previous) => ({
      ...previous,
      character: previous.character.filter((a) => a.type !== 'setTraitNode'),
    }));
  }
  /** Destroys a trashed stack: consumables on the server, jewelry through the saved build. */
  async function trash(stack: InventorySlot) {
    setError('');
    if (stack.kind === 'jewelry') return changeCharacter({ type: 'discardItem', itemId: stack.id });
    if (stack.kind === 'item' && !(await discard(stack.id)))
      setError(`Could not trash the ${stack.name}. Try again.`);
  }
  const { name: itemName, pluralName, icon } = getItem(RESPEC_ITEM);
  const respecItem = {
    name: itemName,
    pluralName,
    icon,
    owned: itemQuantity(items, RESPEC_ITEM),
    isFree: data.isAdmin,
  };
  /** Saves the build when it is valid, then leaves; a failed save keeps the sheet open. */
  async function leave() {
    if (!valid || !decksValid) return onClose();
    await save();
  }

  // --- LOADING AND LOAD ERRORS ---
  if (loading || loadError)
    return (
      <main className="profile-view">
        <header>
          <h1>Profile</h1>
        </header>
        {loading ? (
          <p>Loading character…</p>
        ) : (
          <Button variant="menu" onClick={() => setRetry(retry + 1)}>
            Retry
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
        <footer>
          <Button variant="menu" onClick={onClose}>
            Back
          </Button>
        </footer>
      </main>
    );

  // --- CHARACTER SHEET, OPENING ON THE PROFILE TAB ---
  return (
    <RunCharacterSheet
      character={character}
      onAction={changeCharacter}
      onRespec={() => void respec()}
      respecItem={respecItem}
      inventory={
        <InventoryPanel
          owner={{ character, deck: cards, bag: items }}
          layout={build.bag}
          onLayout={(bag) => setBuild((previous) => ({ ...previous, bag }))}
          onEquip={(slot, itemId, ringIndex) =>
            changeCharacter({ type: 'equipItem', slot, itemId, ...(ringIndex !== undefined && { ringIndex }) })}
          onTrash={(stack) => void trash(stack)}
        />
      }
      onClose={() => void leave()}
      profile={
        <>
          <ProfileStrip username={data.username} wins={wins} bestScore={data.bestScoreToday ?? 0} />
          <ProfileDeck title="Starter deck" note="Choose the deck for your next conquest." cards={cards}>
            <div className="profile-classes">
              {starterNames.map((style) => (
                <Button
                  key={style}
                  variant={style === name ? 'menuPrimary' : 'menu'}
                  aria-pressed={style === name}
                  onClick={() => setBuild({ ...build, selected: style })}
                >
                  {style}
                </Button>
              ))}
            </div>
          </ProfileDeck>
          {saving && <p role="status">Saving…</p>}
          {error && <p role="alert">{error}</p>}
        </>
      }
    />
  );
}
