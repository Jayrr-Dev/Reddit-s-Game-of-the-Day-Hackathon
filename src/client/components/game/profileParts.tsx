// --- PROFILE PARTS ---
// Pieces of the Profile tab shared by the menu's Profile page and the
// character sheet opened mid-battle, so both read the same.
import type { ReactNode } from 'react';
import { getCard, type CardId } from '../../../shared/game/cards';
import { stackDeck } from '../../../shared/game/deckBuilder';
import { CardView } from './CardView';

// --- PLAYER STRIP ---
/** Name, waves won and (when known) today's best score, in one row. */
export const ProfileStrip = ({ username, wins, bestScore }: {
  username: string | null | undefined;
  wins: number;
  bestScore?: number | undefined;
}) => (
  <section className="profile-strip">
    <div>
      <strong>{username ? 'u/' + username : 'Local player'}</strong>
      <span>Player</span>
    </div>
    <div>
      <strong>{wins}</strong>
      <span>Waves won</span>
    </div>
    {bestScore !== undefined && (
      <div>
        <strong>{bestScore}</strong>
        <span>Daily best</span>
      </div>
    )}
  </section>
);

// --- DECK LIST ---
/** A titled deck shown as real cards, one per name, with an xN count. */
export const ProfileDeck = ({ title, note, cards, children }: {
  title: string;
  note: string;
  cards: readonly CardId[];
  /** Controls between the note and the cards (the starter picker). */
  children?: ReactNode;
}) => (
  <section className="profile-decks">
    <h2>{title}</h2>
    <p>{note}</p>
    {children}
    <div className="profile-decklist">
      {stackDeck(cards).map(({ id, count }) => (
        <div key={id} className="profile-deck-card" role="img" aria-label={`${getCard(id).name} x${count}`}>
          <div inert aria-hidden="true">
            <CardView cardId={id} size="fan" />
          </div>
          <b className="profile-deck-count">x{count}</b>
        </div>
      ))}
    </div>
  </section>
);
