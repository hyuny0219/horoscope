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
