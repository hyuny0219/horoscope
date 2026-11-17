"""d3-celestial(BSD-3)과 HYG(CC BY-SA 4.0) 데이터를 사이트용 js/sky-data.js 로 압축한다.

사용법: python3 -I tools/build_sky_data.py <데이터 폴더> js/sky-data.js
필요한 파일: stars.6.json, constellations.lines.json, constellations.json, starnames.json, hyg.csv.gz
"""
import csv
import gzip
import io
import json
import math
import sys
from pathlib import Path

MAG_LIMIT = 6.0          # 어두운 시골 하늘의 맨눈 한계
PC_TO_LY = 3.26156


def ra(lon):
    return round(lon % 360, 3)


def ang_dist(a, b):
    (ra1, d1), (ra2, d2) = a, b
    r1, r2, dd1, dd2 = map(math.radians, (ra1, ra2, d1, d2))
    c = math.sin(dd1) * math.sin(dd2) + math.cos(dd1) * math.cos(dd2) * math.cos(r1 - r2)
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def main(src: Path, out: Path):
    stars = json.loads((src / "stars.6.json").read_text())["features"]
    lines = json.loads((src / "constellations.lines.json").read_text())["features"]
    consts = json.loads((src / "constellations.json").read_text())["features"]
    names = json.loads((src / "starnames.json").read_text())

    # HIP → 거리(광년)
    dist = {}
    with gzip.open(src / "hyg.csv.gz", "rt", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["hip"] and row["dist"]:
                d = float(row["dist"])
                if 0 < d < 100000:
                    dist[int(row["hip"])] = d * PC_TO_LY

    # 별자리 선의 꼭짓점을 가장 가까운 별에 붙인다 (1° 격자로 빠르게 찾기)
    grid = {}
    for f in stars:
        lon, lat = f["geometry"]["coordinates"]
        grid.setdefault((int(ra(lon)), int(math.floor(lat))), []).append(f)

    def nearest(p):
        best, bd = None, 0.2
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for f in grid.get(((int(p[0]) + dx) % 360, int(math.floor(p[1])) + dy), []):
                    lon, lat = f["geometry"]["coordinates"]
                    d = ang_dist((ra(lon), lat), p)
                    if d < bd:
                        best, bd = f, d
        return best

    keep = {f["id"]: f for f in stars if f["properties"]["mag"] <= MAG_LIMIT}
    line_ids = []
    unmatched = 0
    for f in lines:
        segs = []
        for seg in f["geometry"]["coordinates"]:
            ids = []
            for lon, lat in seg:
                s = nearest((ra(lon), lat))
                if s is None:
                    unmatched += 1
                    continue
                keep[s["id"]] = s
                ids.append(s["id"])
            if len(ids) >= 2:
                segs.append(ids)
        line_ids.append((f["id"], segs))

    ordered = sorted(keep.values(), key=lambda f: f["properties"]["mag"])
    index = {f["id"]: i for i, f in enumerate(ordered)}
    star_rows = []
    for f in ordered:
        lon, lat = f["geometry"]["coordinates"]
        try:
            bv = round(float(f["properties"].get("bv") or 0.6), 2)
        except ValueError:
            bv = 0.6
        star_rows.append([ra(lon), round(lat, 3), round(f["properties"]["mag"], 2), bv, round(dist.get(f["id"], 0))])

    # 이름 있는 별: [영문 이름, 별 번호, 한국어 표기, 바이어 기호, 별자리]
    named = []
    for hip, n in names.items():
        i = index.get(int(hip))
        if i is None or not n.get("name"):
            continue
        named.append([n["name"], i, n.get("ko") or "", n.get("bayer") or "", n.get("c") or ""])
    named.sort(key=lambda r: star_rows[r[1]][2])

    info = {f["id"]: f for f in consts}
    const_rows = []
    for cid, segs in line_ids:
        p = info[cid]["properties"]
        lon, lat = info[cid]["geometry"]["coordinates"]
        const_rows.append({
            "id": cid, "ko": p.get("ko") or p["name"], "la": p["name"], "rank": int(p.get("rank") or 3),
            "c": [ra(lon), round(lat, 2)], "l": [[index[s] for s in seg] for seg in segs],
        })

    js = (
        "/* 자동 생성 파일 — tools/build_sky_data.py\n"
        " * 별 위치·별자리 선: d3-celestial (https://github.com/ofrohn/d3-celestial, BSD-3-Clause)\n"
        " * 별까지의 거리: HYG Database (https://github.com/astronexus/HYG-Database, CC BY-SA 4.0)\n"
        " * SKY_STARS: [적경°, 적위°, 등급, B-V 색지수, 거리(광년, 0 = 모름)]\n"
        " * SKY_NAMED: [영문 이름, 별 번호, 한국어 표기, 바이어 기호, 별자리]  SKY_CONSTS.l: 별 번호를 잇는 선 */\n"
        f"const SKY_STARS = {json.dumps(star_rows, separators=(',', ':'))};\n"
        f"const SKY_NAMED = {json.dumps(named, ensure_ascii=False, separators=(',', ':'))};\n"
        f"const SKY_CONSTS = {json.dumps(const_rows, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    out.write_text(js, encoding="utf-8")
    with_dist = sum(1 for r in star_rows if r[4])
    print(f"stars={len(star_rows)} with_dist={with_dist} named={len(named)} consts={len(const_rows)} "
          f"unmatched_vertices={unmatched} bytes={len(js.encode())}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
