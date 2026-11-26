"""Copies the painted layers embedded in the Uriel demo into the game's assets, byte for byte."""
import base64, re, sys
from pathlib import Path

# Demo image id -> asset file stem.
LAYERS = {
    'left-feathers': 'uriel-wing-left',
    'right-feathers': 'uriel-wing-right',
    'original-armor': 'uriel-armor',
    'original-shield': 'uriel-shield',
}
demo = (Path(__file__).parent / 'Archangel-Uriel-Demo.html').read_text(encoding='utf-8')
assets = Path(sys.argv[1]) / 'src/client/assets/heroes/archangels'
found = dict(re.findall(r'<image id="([\w-]+)"[^>]*href="data:image/webp;base64,([A-Za-z0-9+/=]+)"', demo))
assert set(found) == set(LAYERS), sorted(found)
for layer, stem in LAYERS.items():
    (assets / f'{stem}.webp').write_bytes(base64.b64decode(found[layer]))
    print('wrote', stem)
