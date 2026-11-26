# Generates src/client/assets/burn-fire-strip.webp: a 16-frame looping fire bed.
# Original procedural art made for Villain Run (no third-party assets).
# Run: python3 scripts/art/fire-strip.py  (needs numpy and Pillow)
# scrolls it up by 1/16 of its period, so frame 16 lands back on frame 0.
import numpy as np
from PIL import Image, ImageFilter
FRAMES, W, H = 16, 256, 216
OUT = 'src/client/assets/burn-fire-strip.webp'

def tile_noise(px, py, w, h, seed):
    r = np.random.default_rng(seed).random((py, px))
    xs = np.linspace(0, px, w, endpoint=False); ys = np.linspace(0, py, h, endpoint=False)
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int)
    fx = xs - x0; fy = ys - y0; fx = fx*fx*(3-2*fx); fy = fy*fy*(3-2*fy)
    x1 = (x0+1) % px; y1 = (y0+1) % py
    a = r[np.ix_(y0, x0)]; b = r[np.ix_(y0, x1)]; c = r[np.ix_(y1, x0)]; d = r[np.ix_(y1, x1)]
    top = a + (b-a)*fx[None]; bot = c + (d-c)*fx[None]
    return top + (bot-top)*fy[:, None]

def fbm(seed, base_px, base_py, w, h, octs=5):
    tot = 0; amp = 1; norm = 0
    for o in range(octs):
        tot = tot + amp*tile_noise(base_px*2**o, base_py*2**o, w, h, seed+o); norm += amp; amp *= .5
    return tot / norm

FH = H*2
# Tongues: tall, narrow features (many cells across, few down).
tongues = fbm(1, 7, 3, W, FH)
detail = fbm(20, 14, 6, W, FH)
warp = fbm(40, 4, 2, W, FH)

y = np.linspace(0, 1, H)[:, None]       # 0 = top, 1 = bottom
xn = np.linspace(0, 1, W)[None, :]
edge = np.clip(np.minimum(xn, 1-xn) / .3, 0, 1) ** .7   # soften the left/right ends

stops = [(0.0,(60,6,0,0)),(0.12,(120,16,2,120)),(0.3,(200,45,8,220)),(0.5,(245,110,20,250)),
         (0.7,(255,175,50,255)),(0.88,(255,225,130,255)),(1.0,(255,248,205,255))]
def colorize(v):
    out = np.zeros(v.shape+(4,))
    for ch in range(4): out[..., ch] = np.interp(v, [p for p,_ in stops], [c[ch] for _,c in stops])
    return out

def smooth(e0, e1, v):
    t = np.clip((v-e0)/(e1-e0), 0, 1); return t*t*(3-2*t)

sheet = Image.new('RGBA', (W*FRAMES, H))
for f in range(FRAMES):
    s1 = round(FH*f/FRAMES); s2 = round(FH*2*f/FRAMES) % FH; sw = round(FH*f/FRAMES)
    w_ = np.roll(warp, s1, axis=0)[:H]
    # Warp sideways so tongues sway and lick instead of rising straight.
    shift = ((w_-.5)*38*(1.15-y)).astype(int)
    cols = (np.arange(W)[None, :] + shift) % W
    t = np.take_along_axis(np.roll(tongues, s1, axis=0)[:H], cols, axis=1)
    d = np.take_along_axis(np.roll(detail, s2, axis=0)[:H], cols, axis=1)
    n = .72*t + .28*d
    # Fire mass: the lower part is solid, the top is only where noise peaks.
    height = (y**.9) * 1.55 + (n - .5) * 2.3 - .62 - (1-edge) * .75
    mask = smooth(0, .16, height)
    heat = np.clip(height*.95, 0, 1) ** 1.35
    v = np.clip(mask * (.18 + .82*heat), 0, 1)
    rgba = colorize(v); rgba[..., 3] *= mask
    img = Image.fromarray(rgba.astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(.6))
    sheet.paste(img, (f*W, 0))
sheet.save(OUT, 'WEBP', quality=90, method=6)
