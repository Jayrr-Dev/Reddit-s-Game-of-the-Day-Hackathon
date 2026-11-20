// ===================================================================
// API CLIENT
// Typed wrappers around fetch for every /api route. Components and hooks
// call these instead of fetch so URLs and response types live in one place.
// ===================================================================

import type {
  ApiErrorResponse,
  InitResponse,
  LeaderboardResponse,
  SubmitScoreRequest,
  SubmitScoreResponse,
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

// --- ROUTES ---
export const apiClient = {
  init: () => request<InitResponse>('/api/init'),
  leaderboard: () => request<LeaderboardResponse>('/api/leaderboard'),
  submitScore: (payload: SubmitScoreRequest) =>
    request<SubmitScoreResponse>('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
