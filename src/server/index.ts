// ===================================================================
// SERVER ENTRY POINT
// Wires routes into a Hono app and starts the Devvit server.
//   /api/*        -> public routes called by the client
//   /api/telemetry/* -> Devvit Journeys (see http/telemetryBridge.ts)
//   /internal/*   -> menu items, triggers and scheduler jobs (devvit.json)
// ===================================================================

import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { menu } from './routes/menu';
import { scheduler } from './routes/scheduler';
import { triggers } from './routes/triggers';
import { withTelemetryRoutes } from './http/telemetryBridge';

// --- ROUTE TABLE ---
const internal = new Hono();
internal.route('/menu', menu);
internal.route('/triggers', triggers);
internal.route('/scheduler', scheduler);

const app = new Hono();
app.route('/api', api);
app.route('/internal', internal);

// --- START SERVER ---
const requestListener = withTelemetryRoutes(getRequestListener(app.fetch));
createServer(requestListener).listen(getServerPort());
