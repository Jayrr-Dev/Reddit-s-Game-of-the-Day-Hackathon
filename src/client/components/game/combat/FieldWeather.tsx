// ===================================================================
// FIELD WEATHER
// Weather over the battlefield (content/fieldWeather says which fights
// have any). Mist is three layers, styled in index.css ("FIELD MIST"):
//   veil   a cool grey wash over the whole scene, thickest far away
//   far    a slow bank of mist behind the heroes, along the horizon
//   near   a faster, thinner bank in front of them, low on the ground
// The two banks drift at different speeds, so the mist has depth. All
// of it ignores taps and fades in when the fight begins.
// ===================================================================

import type { Weather } from '../../../content/fieldWeather';

// --- CONSTANTS ---
/**
 * Where the layers sit among the field's own (BattlefieldView: backdrop
 * 0, the back row 2, the front row 4): `behind` goes over the scenery
 * and under the heroes, `inFront` over everyone.
 */
const LAYER = { behind: 1, inFront: 5 } as const;

// --- COMPONENT ---
/** Draws the field's weather, if it has any. */
export const FieldWeather = ({ weather }: { weather: Weather | undefined }) => {
  if (weather !== 'mist') return null;
  return (
    <>
      <div
        className="field-mist field-mist-veil"
        style={{ zIndex: LAYER.behind }}
      />
      <div
        className="field-mist field-mist-bank field-mist-far"
        style={{ zIndex: LAYER.behind }}
      />
      <div
        className="field-mist field-mist-bank field-mist-near"
        style={{ zIndex: LAYER.inFront }}
      />
    </>
  );
};
