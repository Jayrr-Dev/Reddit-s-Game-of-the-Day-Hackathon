// ===================================================================
// FIELD WEATHER
// Weather over the battlefield (content/fieldWeather says which fights
// have any). Mist lifts the fight into the clouds, in layers styled in
// index.css ("FIELD MIST"), back to front:
//   sky     a storm sky that hides the map
//   storm   dark cloud hanging from the top of the sky
//   far     small pale puffs along the horizon
//   mid     a bigger bank rolling in under the far row
//   floor   the cloud the heroes stand on
//   near    a thin bank drifting in front of everyone
// Each bank drifts at its own speed, so the cloud has depth. All of it
// ignores taps and fades in when the fight begins.
// ===================================================================

import type { Weather } from '../../../content/fieldWeather';

// --- CONSTANTS ---
/**
 * Where the layers sit among the field's own (BattlefieldView: backdrop
 * 0, the back row 2, the front row 4): `behind` goes over the scenery
 * and under the heroes, `inFront` over everyone.
 */
const LAYER = { behind: 1, inFront: 5 } as const;

/** The banks behind the heroes, back to front. */
const BANKS_BEHIND = ['storm', 'far', 'mid', 'floor'] as const;

// --- COMPONENT ---
/** Draws the field's weather, if it has any. */
export const FieldWeather = ({ weather, overArena = false }: { weather: Weather | undefined; overArena?: boolean }) => {
  if (weather !== 'mist') return null;
  return (
    <>
      <div
        className="field-mist field-mist-sky"
        style={{ zIndex: LAYER.behind, ...(overArena ? { opacity: .22 } : {}) }}
      />
      {BANKS_BEHIND.map((bank) => (
        <div
          key={bank}
          className={`field-mist field-mist-bank field-mist-${bank}`}
          style={{ zIndex: LAYER.behind, ...(overArena ? { opacity: .61 } : {}) }}
        />
      ))}
      <div
        className="field-mist field-mist-bank field-mist-near"
        style={{ zIndex: LAYER.inFront }}
      />
    </>
  );
};
