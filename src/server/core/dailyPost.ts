// ===================================================================
// DAILY POST
// Creates the interactive post for a given day and reads back which day
// a post belongs to. The day is stored in the post's `postData`, so a
// post keeps showing its own day's challenge even weeks later.
// ===================================================================

import { context, reddit, redis } from '@devvit/web/server';
import { GAME_TITLE } from '../../shared/constants/game';
import {
  formatDailyKey,
  getDailyKey,
  isDailyKey,
} from '../../shared/utils/dailyKey';
import { redisKeys } from './redisKeys';

// --- TYPES ---
export type DailyPostResult = {
  postId: string;
  dailyKey: string;
  wasCreated: boolean;
};

// --- FUNCTIONS ---

/** Builds the post title for a day, e.g. "Villain Arc · Fri, Nov 20". */
const buildPostTitle = (dailyKey: string): string =>
  `${GAME_TITLE} · ${formatDailyKey(dailyKey)}`;

/**
 * Creates today's post unless one already exists for that day.
 * The scheduler, the install trigger and the mod menu all call this, so
 * the "already exists" check stops them from creating duplicates.
 */
export const ensureDailyPost = async (
  dailyKey: string = getDailyKey()
): Promise<DailyPostResult> => {
  const existingPostId = await redis.get(redisKeys.dailyPostId(dailyKey));
  if (existingPostId) {
    return { postId: existingPostId, dailyKey, wasCreated: false };
  }

  const post = await reddit.submitCustomPost({
    title: buildPostTitle(dailyKey),
    postData: { dailyKey },
  });
  await redis.set(redisKeys.dailyPostId(dailyKey), post.id);

  return { postId: post.id, dailyKey, wasCreated: true };
};

/**
 * Returns the day the current post belongs to. Falls back to today for
 * posts created without postData (for example the playtest post).
 */
export const getCurrentPostDailyKey = (): string => {
  const storedKey = context.postData?.['dailyKey'];
  return isDailyKey(storedKey) ? storedKey : getDailyKey();
};

/** Builds the reddit.com URL for a post in the current subreddit. */
export const buildPostUrl = (postId: string): string =>
  `https://reddit.com/r/${context.subredditName}/comments/${postId}`;
