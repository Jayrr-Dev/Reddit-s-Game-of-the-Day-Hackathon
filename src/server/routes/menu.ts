// ===================================================================
// MENU ROUTES (/internal/menu/*)
// Handlers for the subreddit menu items declared in devvit.json.
// ===================================================================

import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { buildPostUrl, ensureDailyPost } from '../core/dailyPost';
import { toErrorMessage } from '../http/errors';

export const menu = new Hono();

// --- POST /internal/menu/post-create ---
// Lets a moderator create today's post by hand (useful while playtesting).
menu.post('/post-create', async (c) => {
  try {
    const { postId } = await ensureDailyPost();
    return c.json<UiResponse>({ navigateTo: buildPostUrl(postId) }, 200);
  } catch (error) {
    console.error('menu/post-create failed', error);
    return c.json<UiResponse>(
      { showToast: `Failed to create post: ${toErrorMessage(error)}` },
      400
    );
  }
});
