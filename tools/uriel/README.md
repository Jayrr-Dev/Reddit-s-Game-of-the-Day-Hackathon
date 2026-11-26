# Uriel animation source

Open Archangel-Uriel-Demo.html in a browser for the approved original preview.
The battle atlas uses the layered markup in that file and the editable motion
in uriel-rig.js. From the project root, with Node, PyMuPDF and Pillow installed:

    python tools/uriel/bake_uriel_atlas.py .

The exporter captures the hover, diagonal swing, signature raise, and overhead
slash in that order with a consistent transparent frame. If you change frame
counts or cell size, update src/client/lib/urielMotion.ts and its tests too.
