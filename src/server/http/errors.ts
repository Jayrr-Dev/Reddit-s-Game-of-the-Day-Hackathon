// ===================================================================
// HTTP ERROR HELPERS
// One consistent way to turn failures into JSON responses, so every
// route reports errors in the same ApiErrorResponse shape.
// ===================================================================

import type { Context } from 'hono';
import type { ApiErrorResponse } from '../../shared/types/api';

// --- TYPES ---
type ErrorStatus = 400 | 401 | 404 | 500;

// --- FUNCTIONS ---

/** Converts any thrown value into a readable message. */
export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Sends an ApiErrorResponse with the given status code. */
export const jsonError = (c: Context, status: ErrorStatus, message: string) =>
  c.json<ApiErrorResponse>({ status: 'error', message }, status);
