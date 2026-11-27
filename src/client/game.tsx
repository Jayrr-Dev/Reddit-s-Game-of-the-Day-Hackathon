// ===================================================================
// GAME ENTRYPOINT (devvit.json -> post.entrypoints.default)
// One entry point serves both the tall inline post and expanded mode.
// ===================================================================

import { GameScreen } from './components/GameScreen';
import { mountApp } from './lib/mountApp';

mountApp(<GameScreen />);
