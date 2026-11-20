// ===================================================================
// JOURNEYS (ANALYTICS)
// Named game events on top of Devvit Journeys. The hackathon lists
// Journeys instrumentation as a way to stand out, and Reddit's rules say
// events must follow committed user actions, so the game calls these
// helpers instead of the raw telemetry client.
// Events are dropped (harmlessly) until Reddit approves the app's
// journey map; see README "Devvit Journeys".
// ===================================================================

import { telemetry } from '@devvit/analytics/client/reddit';

// --- HELPERS ---

/** Fires a telemetry call without blocking gameplay or surfacing errors. */
const fireAndForget = (send: () => Promise<unknown>): void => {
  send().catch((error: unknown) =>
    console.warn('journeys event failed', error)
  );
};

// --- EVENTS ---
export const journeys = {
  /** The game screen is loaded and interactive. */
  appReady: () => fireAndForget(() => telemetry.appReady()),
  /** The player pressed Play (an explicit action, never on page load). */
  start: () => fireAndForget(() => telemetry.startJourney()),
  /** The player reached a milestone; `progress` is 0.0 to 1.0. */
  progress: (progress: number, action?: string) =>
    fireAndForget(() =>
      telemetry.progress(action ? { progress, action } : { progress })
    ),
  /** The run ended. */
  end: (result: { complete: boolean; win: boolean; score: number }) =>
    fireAndForget(() =>
      telemetry.endJourney({
        complete: result.complete,
        game: { win: result.win, score: result.score },
      })
    ),
};
