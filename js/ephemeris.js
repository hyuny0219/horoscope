/* 점성술용 천체력 — 태양, 달, 수성~명왕성의 지구 중심 황경(그날의 춘분점 기준), 역행, 상승점·천정점, 사건 찾기
 * 필요: astro.js (julianDay, localSiderealDeg, obliquity, norm360, DEG, PLANET_ELEMENTS, orbitPoint)
 * 정밀도: 태양 0.01°, 달 약 0.05° (Meeus 47장 주요 항), 행성 수 분각 (NASA JPL 근사 궤도 요소, 1800~2050년)
 */

/* 명왕성 궤도 요소 (JPL 같은 표) — 3D 하늘에는 쓰지 않고 점성술 계산에만 쓴다 */
PLANET_ELEMENTS.pluto = PLANET_ELEMENTS.pluto || [
  [39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
  [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
];

const BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

const centuries = (ms) => (julianDay(ms) - 2451545.0) / 36525;

/* 태양 겉보기 황경 (Meeus 25장 간이식) */
function sunLongitude(ms) {
  const T = centuries(ms);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const om = (125.04 - 1934.136 * T) * DEG;
  return norm360(L0 + C - 0.00569 - 0.00478 * Math.sin(om));
}

/* 달 황경 (Meeus 47장, 큰 항 24개) */
const MOON_TERMS = [ // [D, M, M', F, 계수]
  [0, 0, 1, 0, 6.288774], [2, 0, -1, 0, 1.274027], [2, 0, 0, 0, 0.658314], [0, 0, 2, 0, 0.213618],
  [0, 1, 0, 0, -0.185116], [0, 0, 0, 2, -0.114332], [2, 0, -2, 0, 0.058793], [2, -1, -1, 0, 0.057066],
  [2, 0, 1, 0, 0.053322], [2, -1, 0, 0, 0.045758], [0, 1, -1, 0, -0.040923], [1, 0, 0, 0, -0.03472],
  [0, 1, 1, 0, -0.030383], [2, 0, 0, -2, 0.015327], [0, 0, 1, 2, -0.012528], [0, 0, 1, -2, 0.01098],
  [4, 0, -1, 0, 0.010675], [0, 0, 3, 0, 0.010034], [4, 0, -2, 0, 0.008548], [2, 1, -1, 0, -0.007888],
  [2, 1, 0, 0, -0.006766], [1, 0, -1, 0, -0.005163], [1, 1, 0, 0, 0.004987], [2, -1, 1, 0, 0.004036],
];
function moonLongitude(ms) {
  const T = centuries(ms);
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = (297.8501921 + 445267.1114034 * T) * DEG;
  const M = (357.5291092 + 35999.0502909 * T) * DEG;
  const Mp = (134.9633964 + 477198.8675055 * T) * DEG;
  const F = (93.272095 + 483202.0175233 * T) * DEG;
  const E = 1 - 0.002516 * T;
  let s = 0;
  for (const [d, m, mp, f, c] of MOON_TERMS) s += c * (Math.abs(m) === 1 ? E : 1) * Math.sin(d * D + m * M + mp * Mp + f * F);
  return norm360(Lp + s);
}

/* 행성의 지구 중심 황경 (J2000 → 그날 춘분점: 세차 보정) */
function planetLongitude(id, ms) {
  const e = orbitPoint(orbitalElements("earth", ms)), p = orbitPoint(orbitalElements(id, ms));
  return norm360(Math.atan2(p[1] - e[1], p[0] - e[0]) / DEG + 1.396971 * centuries(ms));
}

/* 달의 평균 승교점 (용머리, 일식·월식 판단에 쓴다) */
function lunarNode(ms) { return norm360(125.0445479 - 1934.1362891 * centuries(ms)); }

function bodyLongitude(id, ms) {
  if (id === "sun") return sunLongitude(ms);
  if (id === "moon") return moonLongitude(ms);
  if (id === "node") return lunarNode(ms);
  return planetLongitude(id, ms);
}

/* 하루에 움직이는 각도 (음수면 역행) */
function bodySpeed(id, ms) {
  const h = id === "moon" ? 0.05 : 0.5, a = bodyLongitude(id, ms - h * 86400000), b = bodyLongitude(id, ms + h * 86400000);
  return (((b - a + 540) % 360) - 180) / (2 * h);
}

/* 상승점(ASC)과 천정점(MC) */
function angles(ms, lat, lon) {
  const th = localSiderealDeg(ms, lon) * DEG, e = obliquity(ms) * DEG, p = lat * DEG;
  const asc = norm360(Math.atan2(Math.cos(th), -(Math.sin(th) * Math.cos(e) + Math.tan(p) * Math.sin(e))) / DEG);
  const mc = norm360(Math.atan2(Math.sin(th), Math.cos(th) * Math.cos(e)) / DEG);
  return { asc, mc };
}

/* 어느 순간의 하늘 전체 */
function skyAt(ms) {
  const out = {};
  for (const id of BODIES) out[id] = { id, lon: bodyLongitude(id, ms), speed: bodySpeed(id, ms) };
  for (const id of BODIES) { out[id].sign = Math.floor(out[id].lon / 30); out[id].retro = id !== "sun" && id !== "moon" && out[id].speed < 0; }
  out.node = { id: "node", lon: lunarNode(ms) }; out.node.sign = Math.floor(out.node.lon / 30);
  return out;
}

/* 출생 차트. birth: {y, m, d, hh?, mm?, lat, lon, tz} */
function natalChart(birth) {
  const known = Number.isFinite(birth.hh);
  const ms = Date.UTC(birth.y, birth.m - 1, birth.d, (known ? birth.hh : 12) - birth.tz, known ? birth.mm || 0 : 0);
  const sky = skyAt(ms);
  const pts = BODIES.map((id) => sky[id]);
  let asc = null, mc = null;
  if (known) {
    const a = angles(ms, birth.lat, birth.lon);
    asc = { id: "asc", lon: a.asc, sign: Math.floor(a.asc / 30) };
    mc = { id: "mc", lon: a.mc, sign: Math.floor(a.mc / 30) };
  }
  // 하우스: 시각을 알면 상승궁부터 홀사인, 모르면 태양 별자리부터(솔라 차트)
  const first = asc ? asc.sign : sky.sun.sign;
  for (const p of pts) p.house = ((p.sign - first + 12) % 12) + 1;
  return { ms, birth, known, points: pts, asc, mc, firstHouse: first, sky };
}

/* ---------- 각도(애스펙트) ---------- */
const ASPECT_DEFS = [
  { key: "conj", angle: 0, ko: "합", sym: "☌", nature: "mix" },
  { key: "sextile", angle: 60, ko: "60° 섹스타일", sym: "⚹", nature: "soft" },
  { key: "square", angle: 90, ko: "90° 스퀘어", sym: "□", nature: "hard" },
  { key: "trine", angle: 120, ko: "120° 트라인", sym: "△", nature: "soft" },
  { key: "opp", angle: 180, ko: "180° 대립", sym: "☍", nature: "hard" },
];
const angDiff = (a, b) => { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; };

/* 두 황경 사이 각도가 어떤 애스펙트에 orb 안으로 들어오는지 */
function aspectOf(a, b, orb) {
  const d = angDiff(a, b);
  let best = null;
  for (const A of ASPECT_DEFS) {
    const o = Math.abs(d - A.angle);
    if (o <= orb && (!best || o < best.orb)) best = { ...A, orb: o };
  }
  return best;
}

/* ---------- 사건 찾기 ---------- */
/* f(t)의 부호가 바뀌는 순간을 [a, b] 안에서 이분법으로 (분 단위까지) */
function bisect(f, a, b, fa = f(a)) {
  for (let k = 0; k < 40 && b - a > 60000; k++) {
    const m = (a + b) / 2, fm = f(m);
    if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}
const wrap180 = (x) => ((x % 360) + 540) % 360 - 180;

/* 달이 지금 별자리를 떠나 다음 별자리로 들어가는 순간 */
function nextMoonIngress(ms) {
  const s0 = Math.floor(moonLongitude(ms) / 30);
  const target = ((s0 + 1) % 12) * 30;
  const f = (t) => wrap180(moonLongitude(t) - target);
  let a = ms;
  for (let k = 0; k < 40; k++) { const b = a + 3 * 3600000; if (f(b) >= 0) return { ms: bisect(f, a, b), sign: (s0 + 1) % 12 }; a = b; }
  return null;
}

/* 보이드 오브 코스: 달이 별자리를 떠나기 전, 다른 천체와 마지막 주요 각도를 이룬 뒤부터 다음 별자리에 들어갈 때까지 */
function voidOfCourse(ms) {
  const ing = nextMoonIngress(ms);
  if (!ing) return null;
  const others = ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
  const inSign = (ing.sign + 11) % 12, step = 2 * 3600000;
  let last = null;
  for (let t = ing.ms - 64 * 3600000; t < ing.ms; t += step) {
    const t2 = Math.min(t + step, ing.ms);
    if (Math.floor(moonLongitude(t2) / 30) !== inSign) continue; // 이 별자리에 있는 동안만
    for (const id of others) {
      for (const A of ASPECT_DEFS) {
        // 각도는 앞뒤 양쪽(+, -)이 있다. 합과 대립은 한쪽만
        for (const sgn of A.angle === 0 || A.angle === 180 ? [1] : [1, -1]) {
          const h = (x) => wrap180(norm360(moonLongitude(x) - bodyLongitude(id, x)) - sgn * A.angle);
          const h1 = h(t), h2 = h(t2);
          if ((h1 < 0) !== (h2 < 0) && Math.abs(h1 - h2) < 90) {
            const tx = bisect(h, t, t2, h1);
            if (Math.floor(moonLongitude(tx) / 30) === inSign && (!last || tx > last.ms)) last = { ms: tx, with: id, aspect: A };
          }
        }
      }
    }
  }
  return { start: last ? last.ms : null, end: ing.ms, lastAspect: last, nextSign: ing.sign };
}

/* 다음 새달(삭)·보름(망). 일식·월식 여부도 */
function nextLunation(ms, kind /* "new" | "full" */) {
  const target = kind === "new" ? 0 : 180;
  const f = (t) => wrap180(moonLongitude(t) - sunLongitude(t) - target);
  let a = ms, fa = f(a);
  for (let k = 0; k < 80; k++) {
    const b = a + 12 * 3600000, fb = f(b);
    if (fa < 0 && fb >= 0) {
      const t = bisect(f, a, b, fa);
      const sun = sunLongitude(t), node = lunarNode(t);
      const dn = Math.min(angDiff(sun, node), angDiff(sun, node + 180));
      const eclipse = kind === "new" ? dn < 15.4 : dn < 11.6;
      return { ms: t, kind, lon: moonLongitude(t), sign: Math.floor(moonLongitude(t) / 30), eclipse };
    }
    a = b; fa = fb;
  }
  return null;
}

/* 기간 안의 주요 사건: 새달·보름·식, 행성의 별자리 이동, 역행 시작·끝 */
function eventsBetween(t0, t1, { bodies = ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] } = {}) {
  const ev = [];
  // 새달·보름
  for (const kind of ["new", "full"]) {
    let t = t0;
    for (let k = 0; k < 30; k++) {
      const L = nextLunation(t, kind);
      if (!L || L.ms > t1) break;
      ev.push({ type: L.eclipse ? (kind === "new" ? "solarEclipse" : "lunarEclipse") : kind, ms: L.ms, sign: L.sign, body: "moon" });
      t = L.ms + 86400000;
    }
  }
  const day = 86400000;
  for (const id of bodies) {
    const step = id === "sun" || id === "mercury" || id === "venus" || id === "mars" ? day : 3 * day;
    let prevT = t0, prevLon = bodyLongitude(id, t0), prevSp = bodySpeed(id, t0);
    for (let t = t0 + step; t <= t1 + step; t += step) {
      const tt = Math.min(t, t1), lon = bodyLongitude(id, tt), sp = bodySpeed(id, tt);
      const s0 = Math.floor(prevLon / 30), s1 = Math.floor(lon / 30);
      if (s0 !== s1) {
        // 경계 = 둘 중 가까운 쪽 별자리 경계
        const fwd = ((s0 + 1) % 12) * 30, back = s0 * 30;
        const target = angDiff(lon, fwd) < angDiff(lon, back) ? fwd : back;
        const f = (x) => wrap180(bodyLongitude(id, x) - target);
        const tx = bisect(f, prevT, tt);
        ev.push({ type: "ingress", ms: tx, body: id, sign: s1, retro: sp < 0 });
      }
      if (id !== "sun" && (prevSp < 0) !== (sp < 0)) {
        const tx = bisect((x) => bodySpeed(id, x), prevT, tt, prevSp);
        ev.push({ type: sp < 0 ? "stationR" : "stationD", ms: tx, body: id, sign: Math.floor(bodyLongitude(id, tx) / 30) });
      }
      prevT = tt; prevLon = lon; prevSp = sp;
      if (tt >= t1) break;
    }
  }
  return ev.filter((e) => e.ms >= t0 && e.ms <= t1).sort((a, b) => a.ms - b.ms);
}

/* 움직이는 두 천체(또는 천체와 고정점)가 정확한 각도를 이루는 순간들 */
function exactAspects(t0, t1, pairs, step = 86400000) {
  const out = [];
  for (const { a, b, fixed } of pairs) {
    const lonB = (t) => (fixed != null ? fixed : bodyLongitude(b, t));
    for (const A of ASPECT_DEFS) {
      for (const sgn of A.angle === 0 || A.angle === 180 ? [1] : [1, -1]) {
        const h = (t) => wrap180(norm360(bodyLongitude(a, t) - lonB(t)) - sgn * A.angle);
        let pt = t0, ph = h(t0);
        for (let t = t0 + step; t <= t1 + 1; t += step) {
          const ht = h(t);
          if ((ph < 0) !== (ht < 0) && Math.abs(ph - ht) < 90) out.push({ ms: bisect(h, pt, t, ph), a, b, aspect: A, fixed: fixed != null });
          pt = t; ph = ht;
        }
      }
    }
  }
  return out.sort((x, y) => x.ms - y.ms);
}

/* 지금 진행 중인 개인 트랜짓: 움직이는 천체가 출생 천체와 orb 안에서 이루는 각도 */
const TRANSIT_ORB = { moon: 4, sun: 2.5, mercury: 2, venus: 2, mars: 2.5, jupiter: 2.5, saturn: 2.5, uranus: 2, neptune: 2, pluto: 2 };
function transitsNow(ms, chart, movers = BODIES) {
  const sky = skyAt(ms), soon = skyAt(ms + 3600000 * 6), out = [];
  const natal = [...chart.points, ...(chart.asc ? [chart.asc, chart.mc] : [])];
  for (const tid of movers) {
    for (const n of natal) {
      const asp = aspectOf(sky[tid].lon, n.lon, TRANSIT_ORB[tid]);
      if (!asp) continue;
      const later = angDiff(soon[tid].lon, n.lon);
      const applying = Math.abs(later - asp.angle) < asp.orb; // 각이 좁혀지는 중
      out.push({ transit: tid, natal: n.id, aspect: asp, orb: asp.orb, applying });
    }
  }
  // 느린 천체의 각도일수록 오래가고 무게가 크다
  const weight = { moon: 1, sun: 2, mercury: 2, venus: 2, mars: 3, jupiter: 4, saturn: 5, uranus: 5, neptune: 5, pluto: 5 };
  return out.sort((a, b) => weight[b.transit] - weight[a.transit] || a.orb - b.orb);
}

/* 시너스트리: 두 차트의 천체끼리 이루는 각도 */
function synastry(a, b) {
  const pa = [...a.points.filter((p) => !["uranus", "neptune", "pluto"].includes(p.id)), ...(a.asc ? [a.asc] : [])];
  const pb = [...b.points.filter((p) => !["uranus", "neptune", "pluto"].includes(p.id)), ...(b.asc ? [b.asc] : [])];
  const out = [];
  for (const x of pa) for (const y of pb) {
    const lum = ["sun", "moon"].includes(x.id) || ["sun", "moon"].includes(y.id);
    const asp = aspectOf(x.lon, y.lon, lum ? 8 : 6);
    if (asp) out.push({ a: x.id, b: y.id, aspect: asp, orb: asp.orb });
  }
  return out.sort((p, q) => p.orb - q.orb);
}

/* 세차 때문에 점성술 별자리와 실제 하늘의 별자리는 약 24° 어긋나 있다.
 * 태양이 실제로 지나는 IAU 별자리 경계 (J2000 황경). 뱀주인자리도 지난다. */
const IAU_ECLIPTIC = [ // [시작 황경, 별자리]
  [29.1, "양자리"], [53.4, "황소자리"], [90.1, "쌍둥이자리"], [118.2, "게자리"], [138.0, "사자자리"], [173.9, "처녀자리"],
  [218.0, "천칭자리"], [241.1, "전갈자리"], [247.7, "뱀주인자리"], [266.3, "궁수자리"], [299.7, "염소자리"], [327.9, "물병자리"], [351.6, "물고기자리"],
];
function realConstellationOfSun(ms) {
  const lon = norm360(sunLongitude(ms) - 1.396971 * centuries(ms)); // 그날 춘분점 → J2000
  let name = IAU_ECLIPTIC[IAU_ECLIPTIC.length - 1][1];
  for (const [start, n] of IAU_ECLIPTIC) if (lon >= start) name = n;
  return name;
}
