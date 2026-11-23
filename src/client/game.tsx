// ===================================================================
// GAME ENTRYPOINT (devvit.json -> post.entrypoints.default)
// The whole game plays inline in the post (512 px tall), not expanded.
// ===================================================================

import { GameScreen } from './components/GameScreen';
import { mountApp } from './lib/mountApp';

mountApp(<GameScreen />);
