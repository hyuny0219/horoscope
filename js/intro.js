/* 첫 화면: ① 별 사이를 날아 들어오는 워프(하루 한 번, 건너뛰기 가능)
 * ② 손에 반응하는 살아 있는 별밭(미디어아트) 위의 메뉴
 * ③ '태어난 날의 하늘로' — 시간을 거꾸로 감아 그날 그곳의 실제 하늘로 이동
 * 필요: data.js(SIGNS), sky-data.js(SKY_STARS, SKY_CONSTS). 링크로 들어온 경우(?t= 등)에는 띄우지 않는다. */
(function () {
  const params = new URLSearchParams(location.search);
  if (["t", "s", "c", "p", "go"].some((k) => params.has(k))) return;

  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- DOM ---------- */
  const root = document.createElement("div");
  root.className = "intro";
  root.innerHTML = `
    <canvas class="intro-cv" aria-hidden="true"></canvas>
    <header class="site-head intro-head">
      <a class="brand" href="index.html">별누리</a>
      <nav class="rooms" aria-label="메뉴">
        <a href="index.html" aria-current="page">태어난 날</a>
        <a href="index.html?go=sky">밤하늘</a>
        <a href="zodiac.html#reading">운세</a>
      </nav>
    </header>
    <div class="intro-ui" hidden>
      <p class="intro-kicker">실제 하늘로 떠나는 별 여행</p>
      <h1 class="intro-title">별누리</h1>
      <button type="button" class="intro-cta"><span>✧</span> 내가 태어난 날의 하늘 보러 가기</button>
      <form class="intro-birth" hidden>
        <p class="ib-title">당신이 태어난 날의 하늘로</p>
        <p class="ib-sub">시간을 거슬러, 태어난 순간 그곳의 진짜 하늘을 만나요</p>
        <label>생년월일<input type="date" name="date" required></label>
        <label>태어난 시각 <span class="opt">몰라도 괜찮아요</span><input type="time" name="time"></label>
        <label>성별<select name="gender"><option value="">선택 안 함</option><option value="f">여자</option><option value="m">남자</option></select></label>
        <label>태어난 나라<select name="country"><option>불러오는 중…</option></select></label>
        <label>태어난 도시<select name="city"></select></label>
        <div class="ib-actions"><button type="submit" class="btn btn-star">그날의 하늘로 날아가기</button></div>
      </form>
      <p class="intro-tip">별을 만지거나 움직여 보세요</p>
    </div>
    <div class="intro-rewind" hidden><p class="ir-k">시간을 거슬러 가는 중</p><p class="ir-date"></p></div>
`;
  document.body.prepend(root);
  document.body.classList.add("intro-on");
  const cv = root.querySelector(".intro-cv"), g = cv.getContext("2d");
  const ui = root.querySelector(".intro-ui"), form = root.querySelector(".intro-birth");
  const rew = root.querySelector(".intro-rewind");
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildField();
  }

  /* 별 색: B-V 색지수 → RGB (대략) */
  const bvRGB = (bv) => {
    const t = Math.max(-0.4, Math.min(2, bv));
    if (t < 0) return [170, 195, 255];
    if (t < 0.4) return [215, 225, 255];
    if (t < 0.8) return [255, 246, 228];
    if (t < 1.4) return [255, 214, 160];
    return [255, 176, 120];
  };

  /* ---------- ② 살아 있는 별밭: 실제 별을 천천히 도는 하늘에 투영 ---------- */
  let field = [];
  function buildField() {
    field = [];
    const n = Math.min(SKY_STARS.length, W * H > 900000 ? 4200 : 2400);
    for (let i = 0; i < n; i++) {
      const s = SKY_STARS[i];
      field.push({ ra: s[0], dec: s[1], mag: s[2], c: bvRGB(s[3]), ph: Math.random() * 6.28, ox: 0, oy: 0, vx: 0, vy: 0 });
    }
  }
  const DEG = Math.PI / 180;
  let viewRa = 285, viewDec = 10;
  // 정사영(하늘 공 바깥에서 보는 반구)으로 화면에 놓는다
  function proj(ra, dec, scale) {
    const r = (ra - viewRa) * DEG, d = dec * DEG, d0 = viewDec * DEG;
    const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(r);
    if (cosc < 0) return null;
    const x = Math.cos(d) * Math.sin(r), y = Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(r);
    return [W / 2 - x * scale, H / 2 - y * scale, cosc];
  }
  // 은하수: 실제 은하수 윤곽 점을 작은 캔버스에 부드럽게 그려 두었다가 늘려 붙인다
  const mwCv = document.createElement("canvas"), mg = mwCv.getContext("2d");
  const blob = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return c; })();
  let mwAt = -1e9;
  function drawMilky(now, alpha) {
    if (typeof MILKY_WAY_POINTS === "undefined") return;
    const k = 0.3, scale = Math.max(W, H) * 0.95;
    if (now - mwAt > 350 || mwCv.width !== Math.round(W * k)) {
      mwAt = now; mwCv.width = Math.round(W * k); mwCv.height = Math.round(H * k);
      mg.clearRect(0, 0, mwCv.width, mwCv.height);
      mg.globalCompositeOperation = "lighter";
      for (let i = 0; i < MILKY_WAY_POINTS.length; i++) {
        const [ra, dec, v] = MILKY_WAY_POINTS[i], p = proj(ra, dec, scale);
        if (!p) continue;
        const r = (6 + v * 20) * k * (W < 600 ? 1.3 : 1);
        mg.globalAlpha = 0.04 + v * 0.13;
        mg.drawImage(blob, p[0] * k - r, p[1] * k - r, r * 2, r * 2);
      }
      mg.globalCompositeOperation = "source-in"; // 색 입히기: 가운데는 따뜻하게, 바깥은 푸르게
      const gr = mg.createLinearGradient(0, 0, mwCv.width, mwCv.height);
      gr.addColorStop(0, "rgb(150,170,255)"); gr.addColorStop(0.5, "rgb(255,226,190)"); gr.addColorStop(1, "rgb(170,150,255)");
      mg.fillStyle = gr; mg.fillRect(0, 0, mwCv.width, mwCv.height);
      mg.globalCompositeOperation = "source-over";
    }
    g.save(); g.globalAlpha = 0.95 * alpha; g.globalCompositeOperation = "lighter";
    g.imageSmoothingQuality = "high"; g.drawImage(mwCv, 0, 0, W, H); g.restore();
  }
  // 별자리가 하나씩 그려졌다 사라진다 (12궁과 유명한 별자리)
  const SHOW = ["UMa", "Cas", "Cyg", "Sco", "Leo", "Lyr", "Tau", "Gem", "Peg", "Sgr", "Cru", "Boo", "Per", "Aql", "CMa", "Vir", "Aur", "Ori"];
  const constById = Object.fromEntries(SKY_CONSTS.map((c) => [c.id, c]));
  let art = null, nextArt = 1500, artIdx = 0;
  function startArt(now, id) {
    let c = constById[id];
    while (!c) { c = constById[SHOW[artIdx % SHOW.length]]; artIdx++; }
    const segs = c.l.map((sg) => sg.filter((i) => SKY_STARS[i])).filter((sg) => sg.length > 1);
    if (!segs.length) { nextArt = now + 300; return; }
    const pts = [...new Set(segs.flat())].map((i) => SKY_STARS[i]);
    const ra0 = c.c[0], dec0 = c.c[1];
    // 별자리 자체를 화면 한쪽에 크게 놓는다 (그 별자리 중심에서 본 투영)
    const local = (s) => {
      const r = (s[0] - ra0) * DEG, d = s[1] * DEG, d0 = dec0 * DEG;
      const x = Math.cos(d) * Math.sin(r), y = Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(r);
      return [-x, -y];
    };
    const all = pts.map(local), xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 0.05);
    // 메뉴를 가리지 않게: 모바일은 위쪽 띠, 넓은 화면은 양옆에 그린다
    // 메뉴를 가리지 않게: 넓은 화면은 양옆, 좁은 화면은 머리말과 제목 사이 빈 하늘에 그린다
    const mob = W < 900 || H < 640;
    const titleTop = (ui.querySelector(".intro-kicker:not([hidden])")?.offsetParent ? ui.querySelector(".intro-kicker") : ui.querySelector(".intro-title")).getBoundingClientRect().top;
    const avail = titleTop - 16 - 70;
    let size, cx, cy, faint = false;
    if (!mob) { const side = Math.random() < 0.5; size = Math.min(W * 0.26, H * 0.42); cx = side ? W * 0.17 : W * 0.83; cy = H * (0.4 + Math.random() * 0.2); }
    else if (avail > 130) { size = Math.min(W * 0.66, avail * 0.82); cx = W * (0.42 + Math.random() * 0.16); cy = 70 + avail / 2; }
    else { size = Math.min(W, H) * 0.8; cx = W / 2; cy = H * 0.45; faint = true; } // 빈 하늘이 없으면 뒤에 은은하게
    const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
    const at = (i) => { const p = local(SKY_STARS[i]); return [cx + ((p[0] - mx) / span) * size, cy + ((p[1] - my) / span) * size]; };
    art = { t0: now, ko: c.ko, segs: segs.map((sg) => sg.map(at)), cx, cy, size, faint };
  }
  function drawArt(now) {
    if (!art) { if (now > nextArt) startArt(now); return; }
    const t = (now - art.t0) / 1000, total = art.segs.reduce((a, s) => a + s.length - 1, 0);
    const drawn = Math.min(total, t * 6); // 초당 선 6개
    const fade = (t < 5.5 ? 1 : Math.max(0, 1 - (t - 5.5) / 1.5)) * (art.faint ? 0.35 : 1);
    if (t > 7) { art = null; nextArt = now + 1200; return; }
    g.save(); g.shadowColor = "rgba(242,196,107,.9)"; g.shadowBlur = 10;
    g.lineWidth = 1.4; g.strokeStyle = `rgba(247,222,154,${0.7 * fade})`;
    let k = 0;
    for (const s of art.segs) for (let i = 0; i < s.length - 1; i++, k++) {
      if (k >= drawn) break;
      const f = Math.min(1, drawn - k);
      const [x1, y1] = s[i], [x2, y2] = s[i + 1];
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f); g.stroke();
    }
    for (const s of art.segs) for (const [x, y] of s) {
      g.fillStyle = `rgba(255,244,214,${0.95 * fade})`;
      g.beginPath(); g.arc(x, y, 2.4, 0, 6.283); g.fill();
    }
    g.restore();
    if (drawn >= total) {
      g.font = `500 ${W < 600 ? 15 : 18}px "Gowun Batang", serif`; g.textAlign = "center";
      g.fillStyle = `rgba(247,222,154,${Math.min(1, (t - total / 6) * 1.5) * fade})`;
      const ys = art.segs.flat().map((p) => p[1]);
      g.fillText(art.ko, art.cx, Math.max(...ys) + 28);
    }
  }

  /* 손·마우스: 가까운 별은 살짝 밀려나며 밝아지고, 별 사이에 빛의 실이 이어진다 */
  const ptr = { x: -9999, y: -9999, on: false, t: 0 };
  const move = (e) => { const p = e.touches ? e.touches[0] : e; ptr.x = p.clientX; ptr.y = p.clientY; ptr.on = true; ptr.t = performance.now(); };
  root.addEventListener("pointermove", move, { passive: true });
  root.addEventListener("pointerdown", (e) => { move(e); if (mode === "field" && !e.target.closest(".intro-ui form, .intro-head")) ripples.push({ x: ptr.x, y: ptr.y, t: performance.now() }); }, { passive: true });
  root.addEventListener("pointerleave", () => { ptr.on = false; });
  const ripples = [];

  const tintCache = new Map();
  function tint(c) {
    const key = c.join(); if (tintCache.has(key)) return tintCache.get(key);
    const cv2 = document.createElement("canvas"); cv2.width = cv2.height = 48; const x = cv2.getContext("2d");
    const gr = x.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, `rgba(${key},1)`); gr.addColorStop(0.25, `rgba(${key},.35)`); gr.addColorStop(1, `rgba(${key},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 48, 48); tintCache.set(key, cv2); return cv2;
  }
  function drawField(now, dt, opts = {}) {
    const scale = Math.max(W, H) * 0.95;
    viewRa = (viewRa + dt * (opts.spin || 0.0018)) % 360;
    const near = [];
    for (const s of field) {
      const p = proj(s.ra, s.dec, scale);
      if (!p) continue;
      let [x, y] = p;
      // 손에 밀려난 정도는 스프링으로 돌아온다
      const dx = x + s.ox - ptr.x, dy = y + s.oy - ptr.y, d2 = dx * dx + dy * dy, R = 110;
      if (ptr.on && d2 < R * R) {
        const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.2;
        s.vx += (dx / d) * f; s.vy += (dy / d) * f;
        if (s.mag < 4.6 && near.length < 14) near.push([x + s.ox, y + s.oy, d]);
      }
      s.vx += -s.ox * 0.02; s.vy += -s.oy * 0.02; s.vx *= 0.9; s.vy *= 0.9;
      s.ox += s.vx; s.oy += s.vy;
      x += s.ox; y += s.oy;
      const tw = 0.75 + 0.25 * Math.sin(now / 700 + s.ph);
      const r = Math.max(0.4, (5.2 - s.mag) * 0.42);
      let a = Math.min(1, (0.35 + (5.5 - s.mag) * 0.2) * tw) * (opts.alpha ?? 1);
      for (const rp of ripples) { const age = (now - rp.t) / 1000, dd = Math.hypot(x - rp.x, y - rp.y), front = age * 420; if (Math.abs(dd - front) < 30) a = Math.min(1, a + 0.6 * (1 - age)); }
      const [cr, cg, cb] = s.c;
      if (s.mag < 2.2) {
        const R5 = r * (s.mag < 1 ? 7 : 5);
        g.globalAlpha = a * 0.55; g.drawImage(tint(s.c), x - R5, y - R5, R5 * 2, R5 * 2); g.globalAlpha = 1;
        if (s.mag < 0.8) { // 가장 밝은 별엔 십자 빛
          g.strokeStyle = `rgba(${cr},${cg},${cb},${a * 0.35})`; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(x - R5 * 1.6, y); g.lineTo(x + R5 * 1.6, y); g.moveTo(x, y - R5 * 1.6); g.lineTo(x, y + R5 * 1.6); g.stroke();
        }
      }
      g.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    // 손 주변 별끼리 실로 잇기
    if (near.length > 1) {
      g.lineWidth = 0.8;
      near.sort((a, b) => a[2] - b[2]);
      for (let i = 0; i < near.length - 1; i++) {
        g.strokeStyle = `rgba(247,222,154,${0.35 * (1 - near[i][2] / 110)})`;
        g.beginPath(); g.moveTo(near[i][0], near[i][1]); g.lineTo(near[i + 1][0], near[i + 1][1]); g.stroke();
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const age = (now - ripples[i].t) / 1000;
      if (age > 1.2) { ripples.splice(i, 1); continue; }
      g.strokeStyle = `rgba(247,222,154,${0.35 * (1 - age / 1.2)})`; g.lineWidth = 1;
      g.beginPath(); g.arc(ripples[i].x, ripples[i].y, age * 420, 0, 6.283); g.stroke();
    }
    if (ptr.on && now - ptr.t > 2500) ptr.on = false;
  }

  function nebula(alpha) {
    const gr = g.createRadialGradient(W * 0.7, H * 0.3, 0, W * 0.7, H * 0.3, Math.max(W, H) * 0.7);
    gr.addColorStop(0, `rgba(60,70,140,${0.22 * alpha})`); gr.addColorStop(0.5, `rgba(30,25,70,${0.12 * alpha})`); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  /* ---------- 루프 ---------- */
  let mode = "field";
  let t0 = performance.now(), last = t0, rewind = null;
  function frame(now) {
    if (!root.isConnected) return;
    requestAnimationFrame(frame);
    try { step(now); } catch (e) { art = null; nextArt = now + 1000; }
  }
  function step(now) {
    const dt = Math.min(50, now - last); last = now;
    g.fillStyle = mode === "rewind" ? "rgba(2,3,10,0.12)" : "#02030A";
    g.fillRect(0, 0, W, H);
    if (mode === "field") {
      nebula(1);
      drawMilky(now, 1);
      drawField(now, dt);
      drawArt(now);
    } else if (mode === "rewind") {
      const t = Math.min(1, (now - rewind.t0) / rewind.ms);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      // 장노출 사진처럼 별이 궤적을 그리며 하늘이 거꾸로 돈다 (하루에 한 바퀴 × 감기는 날 수 느낌)
      viewDec = 10 + 60 * Math.sin(Math.min(1, t * 2) * Math.PI / 2); // 북극성 쪽으로 고개를 들며
      drawField(now, dt, { spin: -0.35 * Math.sin(t * Math.PI) - 0.002, alpha: 0.9 });
      // 소용돌이 빛
      g.strokeStyle = `rgba(247,222,154,${0.12 * Math.sin(t * Math.PI)})`;
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(W / 2, H / 2, 60 + k * 70 + (now / 8) % 70, 0, 6.283); g.stroke(); }
      const ms = rewind.from + (rewind.to - rewind.from) * e, d = new Date(ms);
      rew.querySelector(".ir-date").textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
      if (t >= 1 && !rewind.done) { rewind.done = true; g.fillStyle = "#fff"; go(rewind.url); }
    }
  }

  function toField() {
    mode = "field";
    ui.hidden = false; requestAnimationFrame(() => ui.classList.add("on"));
    startArt(performance.now() + 600, "Ori");
    openBirth();
  }
  function close() {
    root.classList.add("out");
    document.body.classList.remove("intro-on");
    setTimeout(() => root.remove(), 700);
  }
  function go(url) { root.classList.add("flash"); setTimeout(() => { location.href = url; }, 350); }



  /* ---------- ③ 태어난 날의 하늘로 ---------- */
  let pick = null;
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); }); }
  root.querySelector(".intro-cta").addEventListener("click", (e) => { e.currentTarget.hidden = true; form.hidden = false; form.date.focus({ preventScroll: true }); art = null; nextArt = performance.now() + 400; });
  async function openBirth() {
    if (!pick) {
      const v = (document.querySelector('script[src*="sky-data.js"]')?.src.match(/\?v=\d+/) || [""])[0];
      try {
        if (typeof WORLD_CITIES === "undefined") await loadScript(`js/places-data.js${v}`);
        if (typeof WorldPlace === "undefined") await loadScript(`js/places.js${v}`);
        pick = WorldPlace.bind(form.country, form.city);
      } catch (e) { form.country.replaceChildren(new Option("대한민국", "KR")); form.city.replaceChildren(new Option("서울", "0")); }
    }
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = form.date.value; if (!date) return;
    const time = form.time.value;
    const pl = pick ? pick.get() : { cc: "KR", country: "대한민국", city: "서울", lat: 37.5665, lon: 126.978, zone: "Asia/Seoul" };
    const b = pick ? WorldPlace.toBirth(date, time, pl) : (() => { const [y, m, d] = date.split("-").map(Number); const o = { y, m, d, tz: 9, lat: pl.lat, lon: pl.lon, place: "서울" }; if (time) [o.hh, o.mm] = time.split(":").map(Number); return o; })();
    const known = Number.isFinite(b.hh);
    const ms = Date.UTC(b.y, b.m - 1, b.d, (known ? b.hh : 21) - b.tz, known ? b.mm || 0 : 0); // 시각을 모르면 그날 밤 9시의 하늘
    const q = new URLSearchParams({ t: String(ms), lat: String(b.lat), lon: String(b.lon), tz: String(b.tz), place: b.place || pl.city, view: "look", birth: "1", b: date, cc: pl.cc, city: pl.city });
    if (time) q.set("tm", time);
    if (form.gender.value) q.set("g", form.gender.value);
    if (!known) q.set("unk", "1");
    ui.classList.remove("on"); setTimeout(() => { ui.hidden = true; }, 400);
    rew.hidden = false;
    mode = "rewind";
    rewind = { t0: performance.now(), ms: reduce ? 600 : 3200, from: Date.now(), to: ms, url: `index.html?${q}` };
  });

  addEventListener("resize", resize);
  resize();
  toField();
  requestAnimationFrame(frame);
})();
