// ===================================================================
// TELEMETRY BRIDGE (DEVVIT JOURNEYS)
// Devvit ships its Journeys analytics router for Express only, while the
// rest of this server uses Hono. Rather than re-implement the router, we
// run Reddit's Express router for /api/telemetry/* and hand every other
// request to Hono. Both speak plain Node (req, res), so they compose
// without either framework knowing about the other.
// ===================================================================

import type { IncomingMessage, ServerResponse } from 'node:http';
import express from 'express';
import { createTelemetryRouter } from '@devvit/analytics/server/reddit';

// --- CONSTANTS ---
/** Base path the @devvit/analytics client posts to by default. */
const TELEMETRY_BASE_PATH = '/api/telemetry';

// --- TYPES ---
type NodeRequestListener = (req: IncomingMessage, res: ServerResponse) => void;

// --- FUNCTIONS ---

/**
 * Returns one request listener that serves Journeys from Reddit's router
 * and passes everything else to `fallback` (the Hono app).
 * The router is mounted under its base path so its JSON body parser only
 * runs for telemetry requests; otherwise it would consume request bodies
 * that Hono still needs to read.
 */
export const withTelemetryRoutes = (fallback: NodeRequestListener) => {
  const app = express();
  app.use(TELEMETRY_BASE_PATH, createTelemetryRouter({ basePath: '' }));
  app.use((req, res) => fallback(req, res));
  return app;
};
