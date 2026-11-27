import { useEffect, useState } from 'react';
import type { CarryCard } from '../../../shared/game/carryCards';
import { ringInventory, type ShopRingId } from '../../../shared/game/ringShop';
import type { BagLayout } from '../../../shared/game/bagLayout';
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
  testJewelry = [],
  testCarry = [],
}: {
  data: InitResponse;
  rings?: RingProgress | undefined;
  onClose: () => void;
  testJewelry?: readonly ShopRingId[];
  testCarry?: readonly CarryCard[];
}) {
  const [build, setBuild] = useState<PlayerBuild>(() =>
    localBuild(data.accountId)
  );
  const [wins, setWins] = useState(data.lifetimeWins ?? 0);
  const [shopRings, setShopRings] = useState<ShopRingId[]>([]);
  const [carry, setCarry] = useState<CarryCard[]>([]);
  const [testActions, setTestActions] = useState<RunAction[]>([]);
  const [testBag, setTestBag] = useState<BagLayout>();
  const [gold, setGold] = useState(data.gold ?? 0);
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
          setGold(result.gold);
          setShopRings(result.shopRings);
          setCarry(result.carryCards ?? []);
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
    createRun(data.dailyKey, rings, 0, wins, shopRings)
  );
  const temporary = ringInventory(testJewelry).filter(item => !run.character.inventory.some(real => real.id === item.id));
  const character = temporary.length ? testActions.reduce(runReducer, { ...run, character: {
    ...run.character, inventory: [...run.character.inventory, ...temporary],
  } }).character : run.character;
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
    if (temporary.length && (action.type === 'equipItem' || (action.type === 'discardItem' && temporary.some(item => item.id === action.itemId)))) {
      setTestActions(previous => [...previous, action]);
      return;
    }
    setBuild((previous) => {
      const current = previous.character.reduce(
        runReducer,
        createRun(data.dailyKey, rings, 0, wins, shopRings)
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
      // A respec refunds every node and lifts the Save traits lock.
      character: previous.character.filter((a) => a.type !== 'setTraitNode' && a.type !== 'saveTraits'),
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
          owner={{ character, bag: items }}
          carryCards={[...new Map([...carry, ...testCarry].map(card => [card.id, card])).values()]}
          layout={temporary.length ? testBag ?? build.bag : build.bag}
          onLayout={(bag) => temporary.length ? setTestBag(bag) : setBuild((previous) => ({ ...previous, bag }))}
          onTrash={(stack) => void trash(stack)}
        />
      }
      onClose={() => void leave()}
      profile={
        <>
          {temporary.length > 0 && <p className="text-xs text-ink-muted">Test jewelry does not transfer to Conquest. Reopen the Shop to reset.</p>}
          <ProfileStrip username={data.username} wins={wins} gold={gold} bestScore={data.bestScoreToday ?? 0} />
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
