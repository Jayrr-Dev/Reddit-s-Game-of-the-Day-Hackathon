// ===================================================================
// SPLASH SCREEN (INLINE VIEW)
// What players see in the Reddit feed. Keep it light: no API calls and
// no heavy dependencies, because it renders for everyone who scrolls by.
// The real game lives in the expanded "game" entrypoint.
// ===================================================================

import { context, requestExpandedMode } from '@devvit/web/client';
import { GAME_TITLE } from '../../shared/constants/game';
import { TAGLINE } from '../content/lore';
import { Button } from './ui/Button';
import { Glyph } from './ui/Glyph';
import { Screen } from './ui/Screen';

/** Greets the player and opens the expanded game view on tap. */
export const SplashScreen = () => (
  <Screen>
    <Glyph name="crown" className="size-10 text-accent" />
    <h1 className="font-display text-3xl font-black tracking-wide text-accent">
      {GAME_TITLE}
    </h1>
    <p className="max-w-xs text-center text-sm text-ink-muted">{TAGLINE}</p>
    <p className="font-display italic">
      {context.username
        ? `The heroes fear you, u/${context.username}.`
        : "Today's horde is marching."}
    </p>
    <Button onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}>
      Begin the conquest
    </Button>
  </Screen>
);
