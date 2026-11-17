/* 회전 성좌판 — 날짜 링, 12궁 링, 별자리 그림을 한 원판에 그리고 드래그/키보드로 돌린다. */
const YEAR = 365;
const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const TAU = Math.PI * 2;

function dayOfYear(month, day) {
  return DAYS_BEFORE[month - 1] + day - 1; // 0 ~ 364 (윤년은 2월 29일을 2월 28일과 같이 취급)
}

function doyToDate(doy) {
  doy = ((Math.round(doy) % YEAR) + YEAR) % YEAR;
  let m = 11;
  while (DAYS_BEFORE[m] > doy) m--;
  return { month: m + 1, day: doy - DAYS_BEFORE[m] + 1 };
}

const SIGN_RANGES = SIGNS.map((s, i) => {
  const start = dayOfYear(s.start[0], s.start[1]);
  const next = SIGNS[(i + 1) % SIGNS.length].start;
  let end = dayOfYear(next[0], next[1]);
  if (end <= start) end += YEAR;
  return { start, end, center: (start + (end - start) / 2) % YEAR };
});

function signIndexForDoy(doy) {
  doy = ((doy % YEAR) + YEAR) % YEAR;
  for (let i = 0; i < SIGN_RANGES.length; i++) {
    const { start, end } = SIGN_RANGES[i];
    if ((doy >= start && doy < end) || (doy + YEAR >= start && doy + YEAR < end)) return i;
  }
  return 0;
}

function signIndexForDate(month, day) {
  if (month === 2 && day === 29) day = 28;
  return signIndexForDoy(dayOfYear(month, day));
}

const doyToAngle = (doy) => (doy / YEAR) * TAU;

/* 시드 난수 (mulberry32) */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class StarWheel {
  constructor(canvas, { onChange } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onChange = onChange || (() => {});
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const now = new Date();
    this.todayDoy = dayOfYear(now.getMonth() + 1, now.getDate() === 29 && now.getMonth() === 1 ? 28 : now.getDate());
    const target = -doyToAngle(this.todayDoy);
    // 처음 열 때 한 번만 원판이 오늘 날짜로 돌아온다
    this.rot = this.reduceMotion ? target : target + Math.PI * 1.25;
    this.targetRot = target;
    this.hover = -1;
    this.lastDoy = null;

    const rand = mulberry32(20261117);
    this.fieldStars = Array.from({ length: 260 }, () => ({
      r: Math.sqrt(rand()) * 0.74, a: rand() * TAU, s: rand() * 0.9 + 0.2, o: rand() * 0.5 + 0.15,
    }));

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindInput();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = rect.width;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.width * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dirty = true;
  }

  get pointerDoy() {
    return ((-this.rot / TAU) * YEAR % YEAR + YEAR) % YEAR;
  }

  /* 원판에서 doy 위치의 화면 각도 (위쪽 = -π/2) */
  screenAngle(doy) {
    return doyToAngle(doy) + this.rot - Math.PI / 2;
  }

  rotateToDoy(doy) {
    const target = -doyToAngle(doy);
    // 가까운 방향으로 돌도록 차이를 -π ~ π로 맞춘다
    let diff = ((target - this.rot) % TAU + TAU) % TAU;
    if (diff > Math.PI) diff -= TAU;
    this.targetRot = this.rot + diff;
    if (this.reduceMotion) this.rot = this.targetRot;
    this.dirty = true;
  }

  goToSign(i) { this.rotateToDoy(SIGN_RANGES[i].center); }
  goToToday() { this.rotateToDoy(this.todayDoy); }

  /* 화면 좌표 → 원판 위 별자리 인덱스 (원판 밖이면 -1) */
  hitTest(x, y) {
    const c = this.size / 2, R = this.size * 0.46;
    const dx = x - c, dy = y - c, dist = Math.hypot(dx, dy);
    if (dist > R * 0.88 || dist < R * 0.14) return -1;
    const ang = Math.atan2(dy, dx) + Math.PI / 2 - this.rot;
    const doy = ((ang / TAU) * YEAR % YEAR + YEAR) % YEAR;
    return signIndexForDoy(doy);
  }

  bindInput() {
    const cv = this.canvas;
    const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const angleAt = (x, y) => Math.atan2(y - this.size / 2, x - this.size / 2);
    let drag = null;

    cv.addEventListener("pointerdown", (e) => {
      const [x, y] = local(e);
      drag = { last: angleAt(x, y), moved: 0, x, y };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      const [x, y] = local(e);
      if (drag) {
        let a = angleAt(x, y), d = a - drag.last;
        if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
        drag.last = a; drag.moved += Math.abs(d);
        this.rot += d; this.targetRot = this.rot;
        cv.classList.add("is-dragging");
      } else {
        const h = this.hitTest(x, y);
        if (h !== this.hover) { this.hover = h; cv.style.cursor = h >= 0 ? "pointer" : "grab"; }
      }
      this.dirty = true;
    });
    const end = (e) => {
      if (!drag) return;
      if (drag.moved < 0.03) {
        const h = this.hitTest(drag.x, drag.y);
        if (h >= 0) this.goToSign(h);
      }
      drag = null;
      cv.classList.remove("is-dragging");
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("pointerleave", () => { if (!drag) { this.hover = -1; this.dirty = true; } });

    cv.addEventListener("keydown", (e) => {
      const cur = signIndexForDoy(this.pointerDoy);
      const n = SIGNS.length;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") this.goToSign((cur + 1) % n);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") this.goToSign((cur - 1 + n) % n);
      else if (e.key === "Home") this.goToToday();
      else return;
      e.preventDefault();
    });
  }

  loop() {
    const diff = this.targetRot - this.rot;
    if (Math.abs(diff) > 0.0005) { this.rot += diff * 0.075; this.dirty = true; }
    else if (diff !== 0) { this.rot = this.targetRot; this.dirty = true; }

    if (this.dirty) {
      this.draw();
      this.dirty = false;
      const doy = Math.floor(this.pointerDoy);
      if (doy !== this.lastDoy) { this.lastDoy = doy; this.onChange(doy, signIndexForDoy(doy)); }
    }
    requestAnimationFrame(this.loop);
  }

  draw() {
    const ctx = this.ctx, W = this.size, c = W / 2, R = W * 0.46;
    const brass = "#C8A15A", star = "#F2EAD3", mist = "#8C97B8";
    const active = signIndexForDoy(this.pointerDoy);
    ctx.clearRect(0, 0, W, W);

    // 원판 바탕
    const g = ctx.createRadialGradient(c, c, R * 0.1, c, c, R);
    g.addColorStop(0, "#1A2856"); g.addColorStop(1, "#0E1838");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();

    // 날짜 링 (R ~ 0.88R)
    ctx.fillStyle = "#0A1230";
    ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.arc(c, c, R * 0.88, 0, TAU, true); ctx.fill();
    ctx.strokeStyle = brass; ctx.lineWidth = 1;
    [R, R * 0.88, R * 0.76].forEach((r) => { ctx.beginPath(); ctx.arc(c, c, r, 0, TAU); ctx.globalAlpha = 0.7; ctx.stroke(); });
    ctx.globalAlpha = 1;

    for (let d = 0; d < YEAR; d++) {
      const { day } = doyToDate(d);
      const a = this.screenAngle(d);
      const len = day === 1 ? R * 0.12 : day % 5 === 0 ? R * 0.035 : R * 0.016;
      ctx.globalAlpha = day === 1 ? 0.9 : 0.45;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
      ctx.lineTo(c + Math.cos(a) * (R - len), c + Math.sin(a) * (R - len));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 월 이름
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `500 ${Math.max(10, R * 0.042)}px "IBM Plex Sans KR", sans-serif`;
    ctx.fillStyle = star;
    for (let m = 0; m < 12; m++) {
      const mid = DAYS_BEFORE[m] + 15;
      this.drawRadialText(`${m + 1}월`, mid, R * 0.925);
    }

    // 12궁 링 (0.88R ~ 0.76R)
    SIGN_RANGES.forEach((rg, i) => {
      const a = this.screenAngle(rg.start);
      ctx.strokeStyle = brass; ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * R * 0.88, c + Math.sin(a) * R * 0.88);
      ctx.lineTo(c + Math.cos(a) * R * 0.76, c + Math.sin(a) * R * 0.76);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const on = i === active;
      ctx.fillStyle = on ? "#F7DE9A" : i === this.hover ? star : mist;
      ctx.font = `${on ? 600 : 400} ${Math.max(10, R * 0.044)}px "Gowun Batang", "Noto Sans Symbols", serif`;
      this.drawRadialText(`${SIGNS[i].glyph} ${SIGNS[i].ko}`, rg.center, R * 0.82);
    });

    // 원판 안쪽 잔별 (원판과 함께 돈다)
    ctx.fillStyle = star;
    for (const s of this.fieldStars) {
      const a = s.a + this.rot;
      ctx.globalAlpha = s.o;
      ctx.beginPath(); ctx.arc(c + Math.cos(a) * s.r * R, c + Math.sin(a) * s.r * R, s.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 황도 (점선)
    ctx.setLineDash([2, 6]); ctx.strokeStyle = brass; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(c, c, R * 0.5, 0, TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    // 별자리
    const S = R * 0.34;
    SIGNS.forEach((sign, i) => {
      const a = this.screenAngle(SIGN_RANGES[i].center);
      const cx = c + Math.cos(a) * R * 0.5, cy = c + Math.sin(a) * R * 0.5;
      const on = i === active, hov = i === this.hover;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a + Math.PI / 2); // 별자리의 '위'가 원판 바깥을 향하도록
      const pt = (p) => [((p[0] - 50) / 100) * S, ((p[1] - 50) / 100) * S];

      ctx.strokeStyle = on ? brass : star;
      ctx.globalAlpha = on ? 0.95 : hov ? 0.6 : 0.22;
      ctx.lineWidth = on ? 1.4 : 1;
      ctx.beginPath();
      for (const [p, q] of sign.lines) {
        const [x1, y1] = pt(sign.stars[p]), [x2, y2] = pt(sign.stars[q]);
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      for (const st of sign.stars) {
        const [x, y] = pt(st);
        const r = (st[2] * 0.9 + 0.6) * (W / 700 + 0.4);
        ctx.globalAlpha = on || hov ? 1 : 0.75;
        if (on) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
          glow.addColorStop(0, "rgba(247,222,154,0.55)"); glow.addColorStop(1, "rgba(247,222,154,0)");
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = on ? "#F7DE9A" : star;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    // 중심 축 (태양)
    const hub = ctx.createRadialGradient(c, c, 0, c, c, R * 0.09);
    hub.addColorStop(0, "#F7DE9A"); hub.addColorStop(0.35, brass); hub.addColorStop(1, "rgba(200,161,90,0)");
    ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(c, c, R * 0.09, 0, TAU); ctx.fill();

    // 고정된 지침 (돌지 않음): 위쪽 창과 황동 삼각형
    ctx.strokeStyle = brass; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(c, c - R * 0.12); ctx.lineTo(c, c - R * 0.76); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = brass;
    ctx.beginPath();
    ctx.moveTo(c, c - R + R * 0.03);
    ctx.lineTo(c - R * 0.035, c - R - R * 0.05);
    ctx.lineTo(c + R * 0.035, c - R - R * 0.05);
    ctx.closePath(); ctx.fill();
  }

  /* 원을 따라 접선 방향으로 글자를 쓴다. 아래쪽 반원에서는 뒤집히지 않게 한다. */
  drawRadialText(text, doy, radius) {
    const ctx = this.ctx, c = this.size / 2;
    const a = this.screenAngle(doy);
    ctx.save();
    ctx.translate(c + Math.cos(a) * radius, c + Math.sin(a) * radius);
    let rot = a + Math.PI / 2;
    const norm = ((a % TAU) + TAU) % TAU;
    if (norm > 0 && norm < Math.PI) rot += Math.PI;
    ctx.rotate(rot);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}
