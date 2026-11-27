// ===================================================================
// API CLIENT
// Typed wrappers around fetch for every /api route. Components and hooks
// call these instead of fetch so URLs and response types live in one place.
// ===================================================================

import type {
  BuyRingRequest,
  BuyRingResponse,
  RingShopResponse,
  ApiErrorResponse,
  FinishRunRequest,
  FinishRunResponse,
  InitResponse,
  ProfileResponse,
  UseItemRequest,
  UseItemResponse,
  DiscardItemResponse,
  LeaderboardResponse,
  SaveUnitStatsRequest,
  SaveUnitStatsResponse,
  StartRunResponse,
} from '../../shared/types/api';

// --- HELPERS ---

/** True when a parsed body is the server's error shape. */
const isApiError = (body: unknown): body is ApiErrorResponse =>
  typeof body === 'object' &&
  body !== null &&
  'status' in body &&
  body.status === 'error';

/** Performs a request and throws a readable error on any failure. */
const request = async <TResponse>(
  path: string,
  init?: RequestInit
): Promise<TResponse> => {
  const response = await fetch(path, init);
  const body: unknown = await response.json();
  if (!response.ok || isApiError(body)) {
    throw new Error(
      isApiError(body) ? body.message : `HTTP ${response.status}`
    );
  }
  // The server types this route with the same shared contract.
  return body as TResponse;
};

/** Sends a JSON POST. */
const postJson = <TResponse>(path: string, payload?: unknown) =>
  request<TResponse>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });

// --- ROUTES ---
export const apiClient = {
  ringShop: () => request<RingShopResponse>('/api/shop/rings'),
  buyRing: (payload: BuyRingRequest) => postJson<BuyRingResponse>('/api/shop/rings/buy', payload),
  profile: () => request<ProfileResponse>('/api/profile'),
  saveProfile: (build: import('../../shared/game/playerBuild').PlayerBuild) => postJson<{saved:boolean}>('/api/profile',build),
  useItem: (payload: UseItemRequest) => postJson<UseItemResponse>('/api/profile/use-item', payload),
  discardItem: (payload: UseItemRequest) => postJson<DiscardItemResponse>('/api/profile/discard-item', payload),
  init: () => request<InitResponse>('/api/init'),
  leaderboard: () => request<LeaderboardResponse>('/api/leaderboard'),
  startRun: () => postJson<StartRunResponse>('/api/run/start'),
  progress: (payload: FinishRunRequest) => postJson<{saved: boolean}>('/api/run/progress', payload),
  finishRun: (payload: FinishRunRequest) =>
    postJson<FinishRunResponse>('/api/run/finish', payload),
  saveUnitStats: (payload: SaveUnitStatsRequest) =>
    postJson<SaveUnitStatsResponse>('/api/admin/unit-stats', payload),
};
/** Read a bundled audio asset for gapless Web Audio playback. */
export async function readAudioAsset(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Map audio unavailable');
  return response.arrayBuffer();
}
