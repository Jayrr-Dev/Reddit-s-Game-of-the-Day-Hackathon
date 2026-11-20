// ===================================================================
// SPLASH SCREEN (INLINE VIEW)
// What players see in the Reddit feed. Keep it light: no API calls and
// no heavy dependencies, because it renders for everyone who scrolls by.
// The real game lives in the expanded "game" entrypoint.
// ===================================================================

import { context, requestExpandedMode } from '@devvit/web/client';
import { GAME_TITLE } from '../../shared/constants/game';
import { Button } from './ui/Button';
import { Screen } from './ui/Screen';

/** Greets the player and opens the expanded game view on tap. */
export const SplashScreen = () => (
  <Screen>
    <h1 className="font-display text-2xl font-bold">{GAME_TITLE}</h1>
    <p className="text-ink-muted">
      {context.username
        ? `Ready, u/${context.username}?`
        : "Today's challenge is live."}
    </p>
    <Button onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}>
      Play
    </Button>
  </Screen>
);
