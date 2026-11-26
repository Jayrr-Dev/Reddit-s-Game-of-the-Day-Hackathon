import { useEffect, useState } from 'react';
import { getCard } from '../../../shared/game/cards';
import { stackDeck } from '../../../shared/game/deckBuilder';
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
import { apiClient } from '../../lib/apiClient';
import { localBuild, storeBuild } from '../../lib/playerBuild';
import { Button } from '../ui/Button';
import { CardView } from './CardView';
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
  }, [data.accountId, retry]);
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
      onRespec={() =>
        setBuild({
          ...build,
          character: build.character.filter((a) => a.type !== 'setTraitNode'),
        })
      }
      onClose={() => void leave()}
      profile={
        <>
          <section className="profile-strip">
            <div>
              <strong>
                {data.username ? 'u/' + data.username : 'Local player'}
              </strong>
              <span>Player</span>
            </div>
            <div>
              <strong>{wins}</strong>
              <span>Waves won</span>
            </div>
            <div>
              <strong>{data.bestScoreToday ?? 0}</strong>
              <span>Daily best</span>
            </div>
          </section>
          <section className="profile-decks">
            <h2>Starter deck</h2>
            <p>Choose the deck for your next conquest.</p>
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
            <div className="profile-decklist">
              {stackDeck(cards).map(({ id, count }) => (
                <div
                  key={id}
                  className="profile-deck-card"
                  role="img"
                  aria-label={`${getCard(id).name} x${count}`}
                >
                  <div inert aria-hidden="true">
                    <CardView cardId={id} size="fan" />
                  </div>
                  <b className="profile-deck-count">x{count}</b>
                </div>
              ))}
            </div>
          </section>
          {saving && <p role="status">Saving…</p>}
          {error && <p role="alert">{error}</p>}
        </>
      }
    />
  );
}
