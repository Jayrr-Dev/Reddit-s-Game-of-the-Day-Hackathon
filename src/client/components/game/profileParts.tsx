// --- PROFILE PARTS ---
// Pieces of the Profile tab shared by the menu's Profile page and the
// character sheet opened mid-battle, so both read the same.
import type { ReactNode } from 'react';
import { getCard, type CardId } from '../../../shared/game/cards';
import { stackDeck } from '../../../shared/game/deckBuilder';
import { CardView } from './CardView';

// Faceted coins with a stamped diamond, readable at inventory-icon size.
export const GoldCoins = () => (
  <svg className="profile-gold-icon" viewBox="0 0 28 26" aria-hidden="true">
    <path d="M2 15c0-2.2 3.6-4 8-4s8 1.8 8 4v5c0 2.2-3.6 4-8 4s-8-1.8-8-4z" fill="#b87120" stroke="#48250e"/>
    <path d="M2 18c0 2.3 3.6 4 8 4s8-1.7 8-4M5 18v4m4-3v4m5-4v4" stroke="#7b4618" fill="none"/>
    <ellipse cx="10" cy="15" rx="8" ry="4" fill="#ffcf65" stroke="#48250e"/>
    <path d="M10 8a8 8 0 1 1 12.4 6.7l-2.4 1.2A8 8 0 0 1 10 8z" fill="#b87120" stroke="#48250e"/>
    <circle cx="18" cy="8.5" r="7.3" fill="#f8c04f" stroke="#48250e"/>
    <circle cx="18" cy="8.5" r="5.7" fill="#db8d29" stroke="#ffe8a4"/>
    <path d="m18 4.5 2.8 4-2.8 4-2.8-4z" fill="#ffdc75" stroke="#885019" strokeWidth=".65"/>
  </svg>
);


// --- PLAYER STRIP ---
/** Name, Gold, waves won and daily best in one row. */
export const ProfileStrip = ({ username, wins, gold, bestScore }: {
  username: string | null | undefined;
  wins: number;
  gold: number;
  bestScore?: number | undefined;
}) => (
  <section className="profile-strip">
    <div>
      <strong>{username ? 'u/' + username : 'Local player'}</strong>
      <span>Player</span>
    </div>
    <div className="profile-gold" title="Gold earned from Conquest victories">
      <strong><GoldCoins />{gold.toLocaleString()}</strong>
      <span>Gold</span>
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
