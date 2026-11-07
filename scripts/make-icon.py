"""Tách nền trắng của logo (design/icon/source-logo.png) và xuất bộ icon Android + web."""
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

c = np.asarray(Image.open('design/icon/source-logo.png').convert('RGB')).astype(float)
d = (255 - c).max(2)
# nền = vùng sáng nối liền với mép ảnh (giữ nguyên các chi tiết trắng bên trong logo)
lab, _ = ndimage.label(d < 90)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
ring = ndimage.binary_dilation(bg, iterations=3) & ~bg & (d < 235)   # viền khử răng cưa
soft = bg | ring
a = np.where(soft, d / 255.0, 1.0)
a[a < 0.04] = 0
A = np.clip(a, 1e-4, 1)[..., None]
F = np.where(soft[..., None], np.clip((c - (1 - A) * 255) / A, 0, 255), c)
out = Image.fromarray(np.dstack([F, a * 255]).astype(np.uint8), 'RGBA')
cut = out.crop(out.getbbox())
w, h = cut.size
S = max(w, h)
sq = Image.new('RGBA', (S, S), (0, 0, 0, 0))
sq.paste(cut, ((S - w) // 2, (S - h) // 2))
big = sq.resize((1024, 1024), Image.LANCZOS)
big.save('design/icon/icon-1024.png')
big.resize((512, 512), Image.LANCZOS).save('design/icon/icon-512.png')
big.resize((192, 192), Image.LANCZOS).save('www/icon.png')

R = 'android/app/src/main/res/'
D = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def place(size, pct, bgc=None, round_=False):
    can = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if bgc:
        m = Image.new('L', (size * 4, size * 4), 0)
        dr = ImageDraw.Draw(m)
        if round_:
            dr.ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
        else:
            dr.rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * .22), fill=255)
        can.paste(Image.new('RGBA', (size, size), bgc), (0, 0), m.resize((size, size), Image.LANCZOS))
    s = int(size * pct)
    can.alpha_composite(big.resize((s, s), Image.LANCZOS), ((size - s) // 2, (size - s) // 2))
    return can

for dd, k in D.items():
    fg = place(int(108 * k), .56)
    fg.save(R + f'mipmap-{dd}/ic_launcher_foreground.png')
    al = np.asarray(fg)[..., 3]
    lum = np.asarray(fg.convert('RGB')).astype(float).max(2)
    mono = np.zeros((*al.shape, 4), np.uint8)
    mono[..., :3] = 255
    mono[..., 3] = (al * np.clip(0.35 + lum / 255, 0, 1)).astype(np.uint8)
    Image.fromarray(mono, 'RGBA').save(R + f'mipmap-{dd}/ic_launcher_monochrome.png')
    place(int(48 * k), .78, '#262930').save(R + f'mipmap-{dd}/ic_launcher.png')
    place(int(48 * k), .70, '#262930', True).save(R + f'mipmap-{dd}/ic_launcher_round.png')
print('Đã xuất icon')
