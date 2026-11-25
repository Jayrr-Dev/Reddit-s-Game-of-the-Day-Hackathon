// ===================================================================
// API CLIENT
// Typed wrappers around fetch for every /api route. Components and hooks
// call these instead of fetch so URLs and response types live in one place.
// ===================================================================

import type {
  ApiErrorResponse,
  FinishRunRequest,
  FinishRunResponse,
  InitResponse,
  LeaderboardResponse,
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
  profile: () => request<{ build: import('../../shared/game/playerBuild').PlayerBuild; wins:number }>('/api/profile'),
  saveProfile: (build: import('../../shared/game/playerBuild').PlayerBuild) => postJson<{saved:boolean}>('/api/profile',build),
  init: () => request<InitResponse>('/api/init'),
  leaderboard: () => request<LeaderboardResponse>('/api/leaderboard'),
  startRun: () => postJson<StartRunResponse>('/api/run/start'),
  progress: (payload: FinishRunRequest) => postJson<{saved: boolean}>('/api/run/progress', payload),
  finishRun: (payload: FinishRunRequest) =>
    postJson<FinishRunResponse>('/api/run/finish', payload),
};
