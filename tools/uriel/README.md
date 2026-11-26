# Uriel animation source

Open Archangel-Uriel-Demo.html in a browser for the approved original preview.

The game no longer bakes a sprite sheet. It draws the same layered rig live:

- Motion: `src/client/lib/urielRig.ts` (geometry) and `src/client/lib/urielMotion.ts` (clips and timing).
- Vector parts: `src/client/content/urielRigArt.ts`.
- Painted layers: the four `uriel-*.webp` files in `src/client/assets/heroes/archangels`, which are the images embedded in the demo, byte for byte.

If the painted layers change in the demo, export them again from the project root:

    python tools/uriel/extract_layers.py .

Then run `npm run images:placeholders`.
