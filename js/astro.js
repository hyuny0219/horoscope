/* 맨눈 관측용 간이 천문 계산 (정밀도: 별 0.1° 이내, 해 약 0.01°, 달 약 1~2°) */
const DEG = Math.PI / 180;
const norm360 = (x) => ((x % 360) + 360) % 360;

function julianDay(ms) { return ms / 86400000 + 2440587.5; }

/* 지방 항성시 (도) */
function localSiderealDeg(ms, lonDeg) {
  const d = julianDay(ms) - 2451545.0;
  return norm360(280.46061837 + 360.98564736629 * d + lonDeg);
}

/* 적도좌표 → 지평좌표. az: 북쪽 0°, 동쪽 90° */
function toAltAz(raDeg, decDeg, latDeg, lstDeg) {
  const H = (lstDeg - raDeg) * DEG, d = decDeg * DEG, p = latDeg * DEG;
  const sinAlt = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
  return { alt: alt / DEG, az: norm360(az / DEG) };
}

function obliquity(ms) { return 23.439 - 0.0000004 * (julianDay(ms) - 2451545.0); }

/* 황도좌표 → 적도좌표 */
function eclToEq(lamDeg, betaDeg, epsDeg) {
  const l = lamDeg * DEG, b = betaDeg * DEG, e = epsDeg * DEG;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra: norm360(ra / DEG), dec: dec / DEG };
}

function sunPosition(ms) {
  const n = julianDay(ms) - 2451545.0;
  const L = norm360(280.46 + 0.9856474 * n), g = norm360(357.528 + 0.9856003 * n) * DEG;
  const lam = L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  return { lam, ...eclToEq(lam, 0, obliquity(ms)) };
}

function moonPosition(ms) {
  const n = julianDay(ms) - 2451545.0;
  const L = 218.316 + 13.176396 * n;
  const M = norm360(134.963 + 13.064993 * n) * DEG;
  const F = norm360(93.272 + 13.22935 * n) * DEG;
  const D = norm360(297.85 + 12.190749 * n) * DEG;
  const lam = norm360(L + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D));
  const beta = 5.128 * Math.sin(F);
  const sun = sunPosition(ms);
  const elong = norm360(lam - sun.lam);              // 0 = 삭, 180 = 망
  const illum = (1 - Math.cos(elong * DEG)) / 2;
  return { lam, elong, illum, waxing: elong < 180, ...eclToEq(lam, beta, obliquity(ms)) };
}

function moonPhaseName(m) {
  const e = m.elong;
  if (e < 12 || e > 348) return "삭 (보이지 않는 달)";
  if (e < 80) return "초승달";
  if (e < 100) return "상현달";
  if (e < 168) return "차오르는 달";
  if (e < 192) return "보름달";
  if (e < 260) return "기우는 달";
  if (e < 280) return "하현달";
  return "그믐달";
}

const DIR8 = ["북쪽", "북동쪽", "동쪽", "남동쪽", "남쪽", "남서쪽", "서쪽", "북서쪽"];
function directionName(az) { return DIR8[Math.round(norm360(az) / 45) % 8]; }

function altitudeWords(alt) {
  if (alt > 70) return "머리 위";
  if (alt > 45) return "높은 하늘";
  if (alt > 20) return "중간 높이";
  return "낮은 하늘";
}

function skyStateWords(sunAlt) {
  if (sunAlt > 0) return "해가 떠 있는 시간이라 별이 보이지 않습니다.";
  if (sunAlt > -6) return "해가 막 지거나 뜨는 때라 밝은 별 몇 개만 보입니다.";
  if (sunAlt > -12) return "하늘이 어두워지는 중입니다. 1등성과 2등성이 보입니다.";
  if (sunAlt > -18) return "거의 어두운 밤입니다.";
  return "완전히 어두운 밤입니다. 별 보기 좋은 시간입니다.";
}

/* B-V 색지수 → 별 색 */
function starColor(bv) {
  const stops = [[-0.3, [155, 176, 255]], [0, [202, 215, 255]], [0.5, [248, 247, 255]], [1.0, [255, 228, 181]], [1.6, [255, 180, 107]]];
  if (bv <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (bv <= stops[i][0]) {
      const [b0, c0] = stops[i - 1], [b1, c1] = stops[i], t = (bv - b0) / (b1 - b0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
    }
  }
  return stops[stops.length - 1][1];
}

/* ---------- 행성 ----------
 * NASA JPL "Keplerian Elements for Approximate Positions of the Major Planets" 표 1 (1800~2050년 유효)
 * [a(AU), e, I, L, 근일점 경도, 승교점 경도] 와 100년당 변화량. 결과는 태양 중심 황도 좌표(J2000, AU). */
const PLANET_ELEMENTS = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
};

function orbitalElements(name, ms) {
  const T = (julianDay(ms) - 2451545.0) / 36525;
  const [e0, r] = PLANET_ELEMENTS[name];
  return e0.map((v, k) => v + r[k] * T); // [a, e, I, L, 근일점, 승교점]
}

/* 궤도 요소 → 태양 중심 황도 좌표. M(평균 근점 이각)을 주면 그 지점을 계산한다 */
function orbitPoint([a, e, I, L, peri, node], M = L - peri) {
  const w = (peri - node) * DEG, O = node * DEG, i = I * DEG;
  let m = (((M % 360) + 540) % 360 - 180) * DEG, E = m + e * Math.sin(m);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E)); // 케플러 방정식
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  return [
    (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

const PLANETS = [
  { id: "mercury", ko: "수성", H: -0.42, color: [190, 180, 170], size: 0.6, period: "88일", kind: "암석 행성", note: "태양에 가장 가까운 행성입니다. 해 질 녘이나 새벽에 지평선 가까이 잠깐 보입니다." },
  { id: "venus", ko: "금성", H: -4.4, color: [255, 240, 205], size: 0.9, period: "225일", kind: "암석 행성", note: "샛별, 개밥바라기라고 불리는 가장 밝은 행성입니다. 두꺼운 구름이 햇빛을 반사합니다." },
  { id: "earth", ko: "지구", H: null, color: [120, 170, 255], size: 0.9, period: "365일", kind: "암석 행성", note: "우리가 사는 곳입니다. 밤하늘의 모든 별은 여기서 본 모습입니다." },
  { id: "mars", ko: "화성", H: -1.52, color: [255, 140, 90], size: 0.7, period: "687일", kind: "암석 행성", note: "붉게 빛나는 행성입니다. 2년 2개월마다 지구에 가까워져 아주 밝아집니다." },
  { id: "jupiter", ko: "목성", H: -9.4, color: [240, 215, 175], size: 1.6, period: "11.9년", kind: "가스 행성", note: "태양계에서 가장 큰 행성입니다. 쌍안경으로도 갈릴레이 위성 네 개가 보입니다." },
  { id: "saturn", ko: "토성", H: -8.88, color: [240, 220, 160], size: 1.4, period: "29.5년", kind: "가스 행성", note: "고리를 가진 행성입니다. 작은 망원경으로도 고리가 보입니다." },
  { id: "uranus", ko: "천왕성", H: -7.19, color: [170, 230, 235], size: 1.1, period: "84년", kind: "얼음 행성", note: "아주 어두운 하늘에서 맨눈으로 겨우 보이는 행성입니다. 옆으로 누운 채 자전합니다." },
  { id: "neptune", ko: "해왕성", H: -6.87, color: [120, 150, 255], size: 1.1, period: "165년", kind: "얼음 행성", note: "망원경으로만 보이는 가장 먼 행성입니다. 계산으로 위치를 예측해 찾아낸 행성입니다." },
];

/* 그날의 행성: 태양 중심 위치, 지구에서 본 적경·적위, 거리, 밝기 */
function planetPositions(ms) {
  const earth = orbitPoint(orbitalElements("earth", ms));
  const eps = 23.43928 * DEG;
  return PLANETS.map((p) => {
    const el = orbitalElements(p.id, ms), h = orbitPoint(el);
    const r = Math.hypot(...h);
    if (p.id === "earth") return { ...p, helio: h, r, el };
    const g = [h[0] - earth[0], h[1] - earth[1], h[2] - earth[2]], delta = Math.hypot(...g);
    const X = g[0], Y = g[1] * Math.cos(eps) - g[2] * Math.sin(eps), Z = g[1] * Math.sin(eps) + g[2] * Math.cos(eps);
    const cosPhase = (r * r + delta * delta - Math.hypot(...earth) ** 2) / (2 * r * delta);
    const phase = Math.acos(Math.max(-1, Math.min(1, cosPhase))) / DEG;
    // 위상 보정 (Meeus, Astronomical Algorithms 41장)
    const i = phase;
    const phaseTerm = { mercury: 0.038 * i - 0.000273 * i * i + 0.000002 * i ** 3, venus: 0.0009 * i + 0.000239 * i * i - 0.00000065 * i ** 3, mars: 0.016 * i, jupiter: 0.005 * i }[p.id] || 0;
    const mag = p.H + 5 * Math.log10(r * delta) + phaseTerm;
    return { ...p, helio: h, r, el, delta, mag, ra: norm360(Math.atan2(Y, X) / DEG), dec: Math.asin(Z / delta) / DEG };
  });
}
