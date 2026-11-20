// ===================================================================
// TRIGGER ROUTES (/internal/triggers/*)
// Handlers for Reddit events declared under "triggers" in devvit.json.
// ===================================================================

import { Hono } from 'hono';
import type { TriggerResponse } from '@devvit/web/shared';
import { ensureDailyPost } from '../core/dailyPost';
import { toErrorMessage } from '../http/errors';

export const triggers = new Hono();

// --- POST /internal/triggers/on-app-install ---
// Seeds the subreddit with today's post so it isn't empty after install.
triggers.post('/on-app-install', async (c) => {
  try {
    const { postId } = await ensureDailyPost();
    return c.json<TriggerResponse>(
      { status: 'success', message: `Daily post ready: ${postId}` },
      200
    );
  } catch (error) {
    console.error('triggers/on-app-install failed', error);
    return c.json<TriggerResponse>(
      { status: 'error', message: toErrorMessage(error) },
      400
    );
  }
});
