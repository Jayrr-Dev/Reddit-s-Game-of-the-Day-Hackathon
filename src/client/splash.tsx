// ===================================================================
// SPLASH ENTRYPOINT (devvit.json -> post.entrypoints.default)
// ===================================================================

import { SplashScreen } from './components/SplashScreen';
import { mountApp } from './lib/mountApp';

mountApp(<SplashScreen />);
