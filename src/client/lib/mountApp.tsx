// ===================================================================
// MOUNT APP
// Shared bootstrap for every HTML entrypoint (splash, game). Keeps the
// StrictMode/root wiring in one place.
// ===================================================================

import '../index.css';

import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/** Renders `app` into the #root element of the current entrypoint. */
export const mountApp = (app: ReactNode): void => {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Missing #root element in entry HTML');
  createRoot(rootElement).render(<StrictMode>{app}</StrictMode>);
};
