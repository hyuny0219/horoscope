/* 전천 지도: 천정이 원의 중심, 지평선이 원의 둘레. 하늘을 올려다본 모습이라 북쪽이 위일 때 동쪽이 왼쪽이다. */

// 뱀자리처럼 두 조각으로 나뉜 별자리를 하나로 합친다
const CONSTELLATIONS = (() => {
  const map = new Map();
  for (const c of SKY_CONSTS) {
    if (!map.has(c.id)) map.set(c.id, { id: c.id, ko: c.ko, la: c.la, rank: c.rank, centers: [], segs: [] });
    const e = map.get(c.id);
    e.centers.push(c.c);
    e.segs.push(...c.l);
  }
  return [...map.values()];
})();
const CONST_BY_ID = Object.fromEntries(CONSTELLATIONS.map((c) => [c.id, c]));

class SkyView {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;
    this.mode = "explore";
    this.showLines = true;
    this.showNames = true;
    this.discovered = new Set();
    this.selected = null;
    this.hint = null;
    this.flash = null;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.place = { lat: 37.57, lon: 126.98 };
    this.time = Date.now();
    this.hoverText = null;

    this.resize();
    window.addEventListener("resize", () => { this.resize(); this.draw(); });
    this.bindInput();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = rect.width;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.width * dpr;
    this.dpr = dpr;
  }

  set(state) { Object.assign(this, state); this.compute(); this.draw(); }

  /* ---------- 계산 ---------- */
  compute() {
    const { lat, lon } = this.place;
    this.lst = localSiderealDeg(this.time, lon);
    const aa = (ra, dec) => toAltAz(ra, dec, lat, this.lst);

    this.stars = SKY_STARS.map(([ra, dec, mag, bv, ly]) => ({ ...aa(ra, dec), mag, bv, ly }));
    this.named = SKY_NAMED.map(([name, i]) => ({ ...this.stars[i], name, i }));
    this.consts = CONSTELLATIONS.map((c) => {
      const segs = c.segs.map((seg) => seg.map((i) => this.stars[i]));
      const centers = c.centers.map(([ra, dec]) => aa(ra, dec));
      const center = centers.reduce((a, b) => (b.alt > a.alt ? b : a));
      return { ...c, segsAA: segs, center };
    });
    this.sun = { ...sunPosition(this.time) };
    Object.assign(this.sun, aa(this.sun.ra, this.sun.dec));
    this.planets = planetPositions(this.time).filter((p) => p.ra !== undefined).map((p) => ({ ...p, ...aa(p.ra, p.dec) }));
    this.moon = moonPosition(this.time);
    Object.assign(this.moon, aa(this.moon.ra, this.moon.dec));
    const eps = obliquity(this.time);
    this.ecliptic = Array.from({ length: 121 }, (_, i) => { const q = eclToEq(i * 3, 0, eps); return aa(q.ra, q.dec); });
  }

  /* 지금 지평선 위에 있는 별자리 (중심 고도 순) */
  visibleConstellations(minAlt = 10) {
    return this.consts.filter((c) => c.center.alt > minAlt).sort((a, b) => b.center.alt - a.center.alt);
  }

  /* ---------- 투영 ---------- */
  get R() { return this.size * 0.46; }

  project({ alt, az }) {
    const r = this.R * Math.tan(((90 - alt) / 2) * DEG); // 입체 투영: 지평선에서 r = R
    const a = az * DEG;
    const x = -r * Math.sin(a), y = -r * Math.cos(a);
    const c = this.size / 2;
    return [c + (x + this.pan.x) * this.zoom, c + (y + this.pan.y) * this.zoom];
  }

  /* ---------- 입력 ---------- */
  bindInput() {
    const cv = this.canvas;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let drag = null;
    const pointers = new Map();

    cv.addEventListener("pointerdown", (e) => {
      pointers.set(e.pointerId, pos(e));
      cv.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      drag = { x, y, sx: x, sy: y, moved: 0, pinch: pointers.size === 2 ? this.pinchDist(pointers) : null, zoom0: this.zoom };
    });
    cv.addEventListener("pointermove", (e) => {
      const [x, y] = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [x, y]);
      if (drag && pointers.size === 2 && drag.pinch) {
        this.setZoom(drag.zoom0 * (this.pinchDist(pointers) / drag.pinch));
        drag.moved = 99;
        return;
      }
      if (drag) {
        const dx = x - drag.x, dy = y - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = x; drag.y = y;
        if (this.zoom > 1 && drag.moved > 4) {
          this.pan.x += dx / this.zoom; this.pan.y += dy / this.zoom;
          this.clampPan(); this.draw();
        }
        return;
      }
      this.updateHover(x, y);
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (!drag) return;
      if (drag.moved < 6 && pointers.size === 0) this.handleClick(drag.sx, drag.sy);
      if (pointers.size === 0) drag = null;
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("pointerleave", () => { this.hoverText = null; this.opts.onHover?.(null); });
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.setZoom(this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    }, { passive: false });
  }

  pinchDist(pointers) {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  setZoom(z) {
    this.zoom = Math.max(1, Math.min(4, z));
    if (this.zoom === 1) this.pan = { x: 0, y: 0 };
    this.clampPan(); this.draw();
  }

  clampPan() {
    const lim = this.R * (1 - 1 / this.zoom);
    this.pan.x = Math.max(-lim, Math.min(lim, this.pan.x));
    this.pan.y = Math.max(-lim, Math.min(lim, this.pan.y));
  }

  /* 화면 좌표에서 가장 가까운 별자리 선 위의 별 */
  nearestConstellation(x, y, radius = 16) {
    let best = null, bestD = radius;
    for (const c of this.consts) {
      for (const seg of c.segsAA) for (const p of seg) {
        if (p.alt < 0) continue;
        const [px, py] = this.project(p);
        const d = Math.hypot(px - x, py - y);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    return best;
  }

  nearestNamedStar(x, y, radius = 12) {
    let best = null, bestD = radius;
    for (const s of this.named) {
      if (s.alt < 0) continue;
      const [px, py] = this.project(s);
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  isRevealed(id) { return this.mode === "explore" || this.discovered.has(id); }

  updateHover(x, y) {
    const c = this.nearestConstellation(x, y);
    const s = this.nearestNamedStar(x, y);
    let text = null;
    if (c && this.isRevealed(c.id)) text = c.ko;
    if (s && (!c || this.isRevealed(c.id))) text = `${starName(s.i)}${text ? ` (${text})` : ""}`;
    this.canvas.style.cursor = c ? "pointer" : this.zoom > 1 ? "grab" : "crosshair";
    if (text !== this.hoverText) { this.hoverText = text; this.opts.onHover?.(text ? { text, x, y } : null); }
  }

  nearestStar(x, y, radius = 12) {
    let best = null, bestD = radius;
    this.stars.forEach((s, i) => {
      if (s.alt < 0 || !NAMED_BY_INDEX.has(i)) return;
      const [px, py] = this.project(s);
      const d = Math.hypot(px - x, py - y) - Math.max(0, 3 - s.mag) * 1.5;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  handleClick(x, y) {
    const star = this.nearestStar(x, y);
    if (star != null) setTimeout(() => { const k = this.consts.find((q) => q.segs.some((sg) => sg.includes(this.stars[star]))); if (!k || this.isRevealed(k.id)) this.opts.onStar?.(star); });
    const c = this.nearestConstellation(x, y, 20);
    if (this.mode === "discover") {
      if (!c) { this.opts.onMiss?.(); return; }
      if (!this.discovered.has(c.id)) {
        this.discovered.add(c.id);
        this.flash = c.id;
        if (this.hint === c.id) this.hint = null;
        this.opts.onDiscover?.(c);
      }
      this.selected = c.id;
      this.opts.onSelect?.(c);
      this.draw();
      return;
    }
    this.selected = c ? c.id : null;
    this.opts.onSelect?.(c);
    this.draw();
  }

  /* ---------- 그리기 ---------- */
  draw() {
    if (!this.stars) return;
    const ctx = this.ctx, S = this.size, R = this.R, c = S / 2;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);

    // 하늘 밝기: 해의 고도에 따라 밤 → 박명 → 낮
    const t = Math.max(0, Math.min(1, (this.sun.alt + 18) / 18)); // 0 = 완전한 밤, 1 = 일출·일몰
    const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const inner = mix([6, 12, 36], [70, 104, 168]), outer = mix([14, 24, 64], [140, 160, 196]);
    const hc = [c + this.pan.x * this.zoom, c + this.pan.y * this.zoom], HR = R * this.zoom;
    const g = ctx.createRadialGradient(hc[0], hc[1], 0, hc[0], hc[1], HR);
    g.addColorStop(0, `rgb(${inner})`); g.addColorStop(1, `rgb(${outer})`);
    ctx.save();
    ctx.beginPath(); ctx.arc(hc[0], hc[1], HR, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();

    const starVis = this.sun.alt > 0 ? 0.08 : 1 - t * 0.85;

    // 고도선 30°, 60°
    ctx.strokeStyle = "rgba(140,151,184,0.22)"; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
    for (const alt of [30, 60]) {
      const r = R * Math.tan(((90 - alt) / 2) * DEG) * this.zoom;
      ctx.beginPath(); ctx.arc(hc[0], hc[1], r, 0, Math.PI * 2); ctx.stroke();
    }

    // 황도
    ctx.strokeStyle = "rgba(200,161,90,0.45)"; ctx.setLineDash([4, 6]);
    this.polyline(this.ecliptic);
    ctx.setLineDash([]);

    // 별자리 선
    for (const k of this.consts) {
      const revealed = this.isRevealed(k.id);
      const sel = k.id === this.selected;
      if (this.mode === "explore" && !this.showLines && !sel) continue;
      if (!revealed) continue;
      ctx.strokeStyle = sel ? "rgba(247,222,154,0.95)" : this.mode === "discover" ? "rgba(200,161,90,0.6)" : "rgba(200,161,90,0.32)";
      ctx.lineWidth = sel ? 1.8 : 1;
      for (const seg of k.segsAA) this.polyline(seg);
    }

    // 별
    for (const s of this.stars) {
      if (s.alt < -1) continue;
      const [x, y] = this.project(s);
      const ext = s.alt < 12 ? 0.35 + (s.alt / 12) * 0.65 : 1; // 지평선 근처는 대기 때문에 흐리다
      const r = Math.max(0.45, Math.min(4.2, 0.55 + (4.6 - s.mag) * 0.62)) * Math.sqrt(this.zoom) * (S < 500 ? 0.8 : 1);
      const faint = s.mag > 4 ? 0.55 : 1;
      const a = Math.max(0, ext * starVis * faint * (s.mag < 1.5 || t < 0.5 ? 1 : 1.6 - s.mag * 0.25));
      if (a < 0.03) continue;
      const [cr, cg, cb] = starColor(s.bv);
      if (s.mag < 1.6 && starVis > 0.4) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        glow.addColorStop(0, `rgba(${cr},${cg},${cb},${0.35 * a})`); glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(1, a)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // 행성
    ctx.font = `600 ${Math.max(11, S * 0.017)}px "IBM Plex Sans KR", sans-serif`;
    ctx.textAlign = "left";
    for (const p of this.planets) {
      if (p.alt < 0 || p.mag > 6.5) continue;
      const [x, y] = this.project(p);
      const r = Math.max(2, 4.2 - p.mag * 0.5);
      ctx.fillStyle = `rgb(${p.color})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,214,150,0.95)";
      ctx.fillText(p.ko, x + r + 4, y - 4);
    }
    ctx.textAlign = "center";

    // 해와 달
    if (this.sun.alt > -1) this.drawSun();
    if (this.moon.alt > -1) this.drawMoon();

    // 힌트 영역 (정확한 위치 대신 넓은 원)
    if (this.hint) {
      const k = this.consts.find((q) => q.id === this.hint);
      if (k && k.center.alt > 0) {
        const [x, y] = this.project(k.center);
        ctx.strokeStyle = "rgba(247,222,154,0.8)"; ctx.setLineDash([3, 5]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, R * 0.2 * this.zoom, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 이름: 겹치는 이름은 건너뛴다 (선택한 별자리를 가장 먼저 자리 잡게 한다)
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const fs = Math.max(11, S * 0.018);
    const boxes = [];
    const place = (x, y, w, h) => {
      const b = [x - w / 2 - 3, y - h / 2 - 2, x + w / 2 + 3, y + h / 2 + 2];
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return false;
      boxes.push(b); return true;
    };
    const minRank = this.zoom >= 1.6 ? 3 : S < 500 ? 1 : 2;
    const labels = this.consts
      .filter((k) => k.center.alt >= 3 && this.isRevealed(k.id))
      .filter((k) => k.id === this.selected || (this.mode === "discover" || (this.showNames && k.rank <= minRank)))
      .sort((a, b) => (b.id === this.selected) - (a.id === this.selected) || a.rank - b.rank);
    for (const k of labels) {
      const sel = k.id === this.selected;
      const [x, y] = this.project(k.center);
      ctx.font = `${sel ? 700 : 400} ${sel ? fs * 1.2 : fs}px "Gowun Batang", serif`;
      if (!place(x, y, ctx.measureText(k.ko).width, fs * 1.2) && !sel) continue;
      ctx.fillStyle = sel || k.id === this.flash ? "#F7DE9A" : "rgba(242,234,211,0.78)";
      ctx.fillText(k.ko, x, y);
    }
    if (this.mode === "explore" && this.showStarNames !== false && starVis > 0.3) {
      ctx.font = `400 ${fs * 0.85}px "IBM Plex Sans KR", sans-serif`;
      ctx.fillStyle = "rgba(200,212,240,0.75)";
      for (const s of this.named) {
        if (s.alt < 5 || s.mag > (this.zoom > 2.5 ? 3 : this.zoom > 1.6 ? 2 : 1.0)) continue;
        const [x, y] = this.project(s);
        const text = starName(s.i), w = ctx.measureText(text).width;
        if (!place(x + 7 + w / 2, y - 8, w, fs)) continue;
        ctx.fillText(text, x + 7 + w / 2, y - 8);
      }
    }
    ctx.restore();

    // 지평선과 방위
    ctx.strokeStyle = "#121419"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(hc[0], hc[1], HR, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `600 ${Math.max(12, S * 0.022)}px "IBM Plex Sans KR", sans-serif`;
    ctx.fillStyle = "#1D1D1F"; // 액자 매트 위에 쓰는 방위 글자
    for (const [label, az] of [["북", 0], ["동", 90], ["남", 180], ["서", 270]]) {
      const a = az * DEG, off = HR + Math.max(14, S * 0.025);
      const x = hc[0] - Math.sin(a) * off, y = hc[1] - Math.cos(a) * off;
      if (x > 0 && x < S && y > 0 && y < S) ctx.fillText(label, x, y);
    }
  }

  polyline(points) {
    const ctx = this.ctx;
    ctx.beginPath();
    let pen = false;
    for (const p of points) {
      if (p.alt < -3) { pen = false; continue; }
      const [x, y] = this.project(p);
      if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      pen = true;
    }
    ctx.stroke();
  }

  drawSun() {
    const ctx = this.ctx, [x, y] = this.project(this.sun), r = Math.max(7, this.size * 0.014) * this.zoom;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, "rgba(255,236,170,1)"); g.addColorStop(0.35, "rgba(255,210,120,0.7)"); g.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
  }

  /* 위상에 맞춰 밝은 면을 그린다 */
  drawMoon() {
    const ctx = this.ctx, [x, y] = this.project(this.moon), r = Math.max(6, this.size * 0.013) * Math.sqrt(this.zoom);
    const k = this.moon.illum, waxing = this.moon.waxing;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(60,70,100,0.9)";
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // 차오르는 달은 해가 있는 서쪽(지도 오른쪽)이 밝다
    const lit = "#F4EFD9", dark = "rgba(60,70,100,1)";
    ctx.fillStyle = lit;
    ctx.beginPath();
    if (waxing) ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    else ctx.arc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.fill();
    // 가운데 타원: 반달보다 크면 밝은색으로 채우고, 작으면 어두운색으로 깎는다
    ctx.fillStyle = k > 0.5 ? lit : dark;
    ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(1 - 2 * k) * r, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.font = `400 ${Math.max(11, this.size * 0.017)}px "IBM Plex Sans KR", sans-serif`;
    ctx.fillStyle = "rgba(244,239,217,0.85)";
    ctx.fillText("달", x, y + r + 12);
  }
}
