"""d3-celestial의 은하수 윤곽(mw.json, 밝기 5단계)을 하늘 전체 이미지와 빛 알갱이 목록으로 만든다.

사용법: python -I tools/build_milkyway.py <mw.json> assets/milkyway.png js/milkyway-data.js
- milkyway.png: 가로 = 적경 0~360°(왼쪽 0°), 세로 = 적위 +90°(위) ~ -90°(아래), 회색조
- milkyway-data.js: 2D 지도와 배경용 [적경, 적위, 밝기] 점 목록
필요: Pillow, numpy
"""
import json
import random
import sys

import numpy as np
from PIL import Image, ImageFilter

W, H = 2048, 1024
LEVEL_GAIN = [0.16, 0.2, 0.22, 0.22, 0.2]  # ol1(가장 넓고 흐림) ~ ol5(가장 밝은 중심)


def level_mask(feature, w, h):
    """천구 북극(은하수 바깥)으로 향하는 경선을 따라 윤곽을 몇 번 건너는지 세어 안팎을 가린다.
    은하수는 하늘을 한 바퀴 두르는 띠라 평면 다각형 채우기로는 안팎을 정할 수 없다."""
    cross = [[] for _ in range(w)]
    for poly in feature["geometry"]["coordinates"]:
        for ring in poly:
            for (l1, b1), (l2, b2) in zip(ring, ring[1:] + ring[:1]):
                l1 %= 360
                d = ((l2 - l1 + 180) % 360) - 180
                if d == 0:
                    continue
                lo, hi = (l1, l1 + d) if d > 0 else (l1 + d, l1)
                x0, x1 = int(np.ceil(lo / 360 * w - 0.5)), int(np.floor(hi / 360 * w - 0.5))
                for x in range(x0, x1 + 1):
                    lon = (x + 0.5) / w * 360
                    while lon < lo:
                        lon += 360
                    while lon > hi:
                        lon -= 360
                    t = (lon - l1) / d if d > 0 else (l1 - lon) / -d
                    cross[x % w].append(b1 + (b2 - b1) * t)
    lat = 90 - (np.arange(h) + 0.5) / h * 180
    mask = np.zeros((h, w), dtype=np.uint8)
    for x in range(w):
        c = np.sort(np.array(cross[x]))
        if len(c):
            above = len(c) - np.searchsorted(c, lat, side="right")  # 이 점보다 북쪽에서 건너는 횟수
            mask[:, x] = (above % 2) * 255
    return Image.fromarray(mask)


def main(src, png_out, js_out):
    mw = json.load(open(src))
    acc = np.zeros((H, W), dtype=np.float32)
    for level, f in enumerate(sorted(mw["features"], key=lambda f: f["id"])):
        mask = level_mask(f, W, H)
        blurred = mask.filter(ImageFilter.GaussianBlur(radius=2.5 + 2 * (4 - level)))
        acc += np.asarray(blurred, dtype=np.float32) / 255 * LEVEL_GAIN[level]
    acc = np.clip(acc / acc.max(), 0, 1) ** 0.9
    img = Image.fromarray((acc * 255).astype(np.uint8), "L")
    img.save(png_out, optimize=True)

    # 밝기에 비례해 점을 뽑는다 (적위에 따라 면적 보정)
    rng = random.Random(42)
    small = np.asarray(img, dtype=np.float32) / 255
    h, w = small.shape
    pts = []
    while len(pts) < 9000:
        x, y = rng.randrange(w), rng.randrange(h)
        lat = 90 - (y + rng.random()) / h * 180
        v = small[y, x]
        if rng.random() < v * np.cos(np.radians(lat)):
            lon = (x + rng.random()) / w * 360
            pts.append([round(lon, 2), round(lat, 2), round(float(v), 2)])
    with open(js_out, "w", encoding="utf-8") as fh:
        fh.write("/* 자동 생성 파일 — tools/build_milkyway.py. 원본: d3-celestial mw.json (BSD-3-Clause)\n"
                 " * [적경°, 적위°, 밝기 0~1] */\n")
        fh.write("const MILKY_WAY_POINTS = " + json.dumps(pts, separators=(",", ":")) + ";\n")
    print(f"png={png_out} points={len(pts)}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
