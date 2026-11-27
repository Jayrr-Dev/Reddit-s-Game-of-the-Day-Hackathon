# ===================================================================
# ANGEL ARCHER HD ATLAS
# Bakes src/client/assets/heroes/woodland-archers/angel-archer-hd-atlas.webp
# from the original 16 + 16 frame atlas (angel-archer-flight-atlas.webp).
#
# WHY: the original frames are 154 x 146 px, so the field stretches
# them 2-3x on phones and they look blurry, and the hover loop plays
# only 16 frames (~10 fps), which reads as choppy.
#
# HOW:
#   1. Upscale every frame (cubic, premultiplied alpha).
#   2. Hover row only: add two in-between frames per gap with optical
#      flow, so 16 frames become 48 (~31 fps over the same 1.55 s).
#   3. Snap every pixel to the art's own flat palette at 4x, then
#      area-downsample to 2x. The art is flat polygons, so snapping
#      restores the hard colour edges the upscale softened, and the
#      downsample gives them clean anti-aliasing.
#
# LAYOUT: an 8 x 8 grid of 308 x 292 frames, row-major.
#   Rows 0-5: hover loop, 48 frames.   Rows 6-7: bow shot, 16 frames.
#   woodland-archer.css steps through it; keep the two in sync.
#
# Run: python3 scripts/art/angel-archer-hd.py  (needs numpy, Pillow,
# opencv-python-headless), then `npm run images:placeholders`.
# ===================================================================
import cv2
import numpy as np
from PIL import Image

# --- SETTINGS ---
SRC = 'src/client/assets/heroes/woodland-archers/angel-archer-flight-atlas.webp'
OUT = 'src/client/assets/heroes/woodland-archers/angel-archer-hd-atlas.webp'
FW, FH, FRAMES = 154, 146, 16
WORK = 4          # working scale for flow and palette snapping
SCALE = 2         # shipped scale
HOVER_STEPS = 3   # hover frames per source frame (1 original + 2 in-betweens)
COLS = 8
PALETTE_SIZE = 32


# --- LOADING ---
def load_rows():
    """Both source rows as lists of premultiplied float RGBA frames."""
    atlas = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32) / 255
    rows = []
    for row in range(2):
        frames = []
        for i in range(FRAMES):
            f = atlas[row * FH:(row + 1) * FH, i * FW:(i + 1) * FW].copy()
            f[..., :3] *= f[..., 3:4]
            frames.append(f)
        rows.append(frames)
    return rows


def upscale(frame):
    """Cubic upscale to the working scale, in premultiplied space."""
    return cv2.resize(frame, (FW * WORK, FH * WORK), interpolation=cv2.INTER_CUBIC).clip(0, 1)


# --- IN-BETWEENS ---
def flow_gray(frame):
    """Greyscale over green so the silhouette edge drives the flow too."""
    bg = np.array([0.16, 0.35, 0.16], np.float32)
    rgb = frame[..., :3] + bg * (1 - frame[..., 3:4])
    return (cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY) * 255).astype(np.uint8)


def warp(frame, flow, t):
    """Pull pixels back along a fraction t of the flow field."""
    h, w = flow.shape[:2]
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    return cv2.remap(frame, gx - t * flow[..., 0], gy - t * flow[..., 1],
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def tween(a, b, t, dis):
    """Frame t of the way from a to b: both warped toward t, then blended."""
    ga, gb = flow_gray(a), flow_gray(b)
    ab = dis.calc(ga, gb, None)
    ba = dis.calc(gb, ga, None)
    return (1 - t) * warp(a, ab, t) + t * warp(b, ba, 1 - t)


def hover_frames(frames):
    """The looping hover with HOVER_STEPS frames per source frame."""
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    out = []
    for i, a in enumerate(frames):
        b = frames[(i + 1) % len(frames)]
        out.append(a)
        out.extend(tween(a, b, k / HOVER_STEPS, dis) for k in range(1, HOVER_STEPS))
    return out


# --- PALETTE SNAP ---
def build_palette(frames):
    """The art's flat colours, from opaque pixels of every source frame."""
    opaque = np.concatenate([f[f[..., 3] > 0.98][:, :3] for f in frames]).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 1e-4)
    _, _, centres = cv2.kmeans(opaque, PALETTE_SIZE, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    return centres


def snap(frame, palette):
    """Nearest palette colour per pixel, hard alpha edge, then downsample."""
    alpha = frame[..., 3:4]
    rgb = np.where(alpha > 1e-3, frame[..., :3] / np.maximum(alpha, 1e-3), 0).clip(0, 1)
    flat = rgb.reshape(-1, 3)
    nearest = ((flat[:, None, :] - palette[None]) ** 2).sum(2).argmin(1)
    rgb = palette[nearest].reshape(rgb.shape)
    hard = np.clip((alpha - 0.5) * 3 + 0.5, 0, 1)
    pm = np.dstack([rgb * hard, hard])
    small = cv2.resize(pm, (FW * SCALE, FH * SCALE), interpolation=cv2.INTER_AREA)
    a = small[..., 3:4]
    small[..., :3] = np.where(a > 1e-3, small[..., :3] / np.maximum(a, 1e-3), 0)
    return small.clip(0, 1)


# --- MAIN ---
def main():
    hover_src, shot_src = load_rows()
    palette = build_palette(hover_src + shot_src)
    hover = hover_frames([upscale(f) for f in hover_src])
    shot = [upscale(f) for f in shot_src]
    frames = [snap(f, palette) for f in hover + shot]
    rows = -(-len(frames) // COLS)
    w, h = FW * SCALE, FH * SCALE
    sheet = np.zeros((rows * h, COLS * w, 4), np.float32)
    for i, f in enumerate(frames):
        r, c = divmod(i, COLS)
        sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = f
    Image.fromarray((sheet * 255).round().astype(np.uint8)).save(OUT, quality=90, method=6)
    print(f'{OUT}: {len(hover)} hover + {len(shot)} shot frames, {COLS} x {rows} grid of {w} x {h}')


if __name__ == '__main__':
    main()
