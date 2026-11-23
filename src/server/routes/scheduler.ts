// ===================================================================
// SCHEDULER ROUTES (/internal/scheduler/*)
// Cron jobs declared under "scheduler.tasks" in devvit.json. The daily
// job is what makes this a daily game: a fresh post appears every day
// without a moderator lifting a finger.
// ===================================================================

import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import { ensureDailyPost } from '../core/dailyPost';

export const scheduler = new Hono();

// --- POST /internal/scheduler/daily-post ---
// Runs at 00:00 UTC (see devvit.json) and creates that day's post.
scheduler.post('/daily-post', async (c) => {
  try {
    const result = await ensureDailyPost();
    console.log('scheduler/daily-post', result);
  } catch (error) {
    // Log and still answer ok: a thrown error here would not create the post
    // any faster, and the mod menu remains a manual fallback.
    console.error('scheduler/daily-post failed', error);
  }
  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
