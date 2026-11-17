/* 공유 카드: 오늘의 하늘 카드, 내 차트 카드 (1080×1350, 인스타그램 4:5)
 * 캔버스로 그려 이미지로 저장하거나 휴대폰 공유 창으로 보낸다. */
const ShareCard = (() => {
  const W = 1080, H = 1350;
  const SERIF = '"Gowun Batang", "Nanum Myeongjo", serif';
  const SANS = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const GLYPH = '"Noto Sans Symbols", "Segoe UI Symbol", "Apple Symbols", sans-serif';
  const GOLD = "#F7DE9A", INK = "#E8E9F0", MUTED = "#A3AAC0";
  const SITE = "hyuny0219.github.io/horoscope";
  const T = (glyph) => glyph + "\uFE0E"; // 이모지 대신 글자 모양으로

  async function fontsReady() {
    if (!document.fonts) return;
    await Promise.all([`700 64px ${SERIF}`, `400 40px ${SERIF}`, `500 32px ${SANS}`, `400 40px ${GLYPH}`].map((f) => document.fonts.load(f).catch(() => {})));
  }

  /* 배경: 깊은 밤하늘 + 은은한 빛 + 별 (같은 날짜는 같은 별) */
  function backdrop(g, seed) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0B1030"); bg.addColorStop(0.55, "#070A1C"); bg.addColorStop(1, "#03050C");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W * 0.8, H * 0.12, 0, W * 0.8, H * 0.12, W * 0.8);
    glow.addColorStop(0, "rgba(247,222,154,0.16)"); glow.addColorStop(1, "rgba(247,222,154,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 420; i++) {
      const x = rnd() * W, y = rnd() * H, r = rnd() ** 3 * 2.2 + 0.4, a = 0.25 + rnd() * 0.7;
      g.fillStyle = `rgba(${rnd() < 0.2 ? "255,226,190" : "215,225,255"},${a})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = "rgba(247,222,154,0.35)"; g.lineWidth = 2;
    g.strokeRect(36, 36, W - 72, H - 72);
  }

  /* 글을 너비에 맞춰 줄바꿈 (띄어쓰기 우선) */
  function wrap(g, text, x, y, maxW, lh, maxLines = 99) {
    const words = text.split(/(\s+)/);
    let line = "", lines = [];
    for (const w of words) {
      const test = line + w;
      if (g.measureText(test).width > maxW && line.trim()) { lines.push(line.trim()); line = w.trimStart(); }
      else line = test;
      // 한 단어가 너무 길면 글자 단위로 자른다
      while (g.measureText(line).width > maxW) {
        let k = line.length; while (k > 1 && g.measureText(line.slice(0, k)).width > maxW) k--;
        lines.push(line.slice(0, k)); line = line.slice(k);
      }
    }
    if (line.trim()) lines.push(line.trim());
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, "…"); }
    lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
    return y + lines.length * lh;
  }

  /* 황도 고리: 12궁과 그 순간 천체 위치 */
  function zodiacRing(g, cx, cy, R, sky, opts = {}) {
    const rot = opts.ascLon != null ? 180 + opts.ascLon : 180;
    const P = (lon, r) => { const a = (rot - lon) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    g.save();
    g.strokeStyle = "rgba(232,233,240,0.35)"; g.lineWidth = 2;
    for (const r of [R, R * 0.8]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.025)"; g.beginPath(); g.arc(cx, cy, R * 0.62, 0, Math.PI * 2); g.fill();
    g.textAlign = "center"; g.textBaseline = "middle";
    const elCol = { 불: "#FF9C7A", 흙: "#C9B37E", 공기: "#A9C7FF", 물: "#7FD3D0" };
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = P(i * 30, R * 0.8), [x2, y2] = P(i * 30, R);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [tx, ty] = P(i * 30 + 15, R * 0.9);
      g.font = `${Math.round(R * 0.11)}px ${GLYPH}`; g.fillStyle = elCol[SIGNS[i].element];
      g.fillText(T(SIGNS[i].glyph), tx, ty);
    }
    // 각도 선
    const pts = opts.points || [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = aspectOf(pts[i].lon, pts[j].lon, 6);
      if (!a || a.key === "conj") continue;
      const [x1, y1] = P(pts[i].lon, R * 0.6), [x2, y2] = P(pts[j].lon, R * 0.6);
      g.strokeStyle = a.nature === "soft" ? "rgba(127,168,255,0.55)" : "rgba(255,122,106,0.55)"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    // 천체
    const placed = [];
    g.font = `${Math.round(R * 0.1)}px ${GLYPH}`; g.fillStyle = GOLD;
    for (const p of [...pts].sort((a, b) => a.lon - b.lon)) {
      let r = R * 0.71;
      while (placed.some((q) => angDiff(q.lon, p.lon) < 8 && Math.abs(q.r - r) < R * 0.08)) r -= R * 0.09;
      placed.push({ lon: p.lon, r });
      const [x, y] = P(p.lon, r);
      g.fillText(T(BODY_KO[p.id].glyph), x, y);
    }
    if (opts.ascLon != null) {
      const [x1, y1] = P(opts.ascLon, R * 0.6), [x2, y2] = P(opts.ascLon, R + 14);
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [tx, ty] = P(opts.ascLon, R + 36); g.font = `600 22px ${SANS}`; g.fillStyle = INK; g.fillText("AC", tx, ty);
    }
    g.restore();
  }

  function header(g, kicker) {
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.font = `700 40px ${SERIF}`; g.fillStyle = INK; g.fillText("별누리", 84, 120);
    g.font = `500 26px ${SANS}`; g.fillStyle = MUTED; g.textAlign = "right"; g.fillText(kicker, W - 84, 118);
    g.textAlign = "left";
  }
  function footer(g, line) {
    g.font = `400 24px ${SANS}`; g.fillStyle = MUTED; g.textAlign = "left";
    g.fillText(line, 84, H - 84);
    g.textAlign = "right"; g.fillStyle = GOLD; g.fillText(SITE, W - 84, H - 84); g.textAlign = "left";
  }

  /* 오늘 카드 */
  async function today(d) {
    await fontsReady();
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    backdrop(g, d.seed);
    header(g, d.dateLabel);
    // 별자리
    g.font = `400 120px ${GLYPH}`; g.fillStyle = GOLD; g.fillText(T(SIGNS[d.sign].glyph), 78, 300);
    g.font = `700 76px ${SERIF}`; g.fillStyle = INK; g.fillText(SIGNS[d.sign].ko, 230, 268);
    g.font = `400 28px ${SANS}`; g.fillStyle = MUTED; g.fillText(d.basisLabel, 234, 312);
    // 하늘 한 줄
    g.font = `400 30px ${SERIF}`; g.fillStyle = INK;
    let y = wrap(g, d.skyLine, 84, 400, W - 168, 46, 2);
    // 오늘의 핵심
    y += 26;
    g.fillStyle = "rgba(247,222,154,0.12)"; g.fillRect(84, y - 10, W - 168, 4);
    y += 52;
    g.font = `600 30px ${SANS}`; g.fillStyle = GOLD; g.fillText(d.headlineKicker, 84, y);
    y += 58;
    g.font = `700 46px ${SERIF}`; g.fillStyle = INK; y = wrap(g, d.headline, 84, y, W - 168, 62, 2);
    y += 6;
    g.font = `400 31px ${SERIF}`; g.fillStyle = "rgba(232,233,240,0.9)"; y = wrap(g, d.body, 84, y, W - 168, 50, 4);
    // Do / Don't
    y = Math.min(Math.max(y + 60, 800), 900);
    const colW = (W - 168 - 40) / 2;
    for (const [k, list, col, x] of [["해 보면 좋은 것", d.doList, "#9FD8A8", 84], ["피하면 좋은 것", d.dontList, "#FF9C7A", 84 + colW + 40]]) {
      g.font = `600 30px ${SANS}`; g.fillStyle = col; g.fillText(k, x, y);
      g.font = `400 28px ${SANS}`; g.fillStyle = INK;
      let yy = y + 48;
      for (const item of list.slice(0, 3)) yy = wrap(g, `· ${item}`, x, yy, colW, 40, 2) + 6;
    }
    // 오늘의 하늘 고리
    zodiacRing(g, W - 215, 1070, 118, null, { points: d.points });
    g.font = `400 24px ${SANS}`; g.fillStyle = MUTED; g.textAlign = "left";
    wrap(g, d.ringCaption, 84, 1110, W - 480, 36, 3);
    footer(g, "오늘 실제 하늘로 계산한 운세");
    return cv;
  }

  /* 내 차트 카드 */
  async function chart(d) {
    await fontsReady();
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    backdrop(g, d.seed);
    header(g, "나의 출생 차트");
    g.font = `400 30px ${SANS}`; g.fillStyle = MUTED; g.fillText(d.whoLabel, 84, 190);
    zodiacRing(g, W / 2, 545, 300, null, { points: d.points, ascLon: d.ascLon });
    // 빅3
    const big = [["태양", d.sun, "나의 성격"], ["달", d.moon, "나의 감정"], ["상승", d.rising, "남이 보는 나"]];
    const cw = (W - 168) / 3;
    big.forEach(([k, sign, sub], i) => {
      const x = 84 + i * cw + cw / 2;
      g.textAlign = "center";
      g.font = `500 26px ${SANS}`; g.fillStyle = MUTED; g.fillText(`${k} · ${sub}`, x, 925);
      if (sign == null) { g.font = `400 40px ${SERIF}`; g.fillStyle = MUTED; g.fillText("—", x, 990); return; }
      g.font = `400 54px ${GLYPH}`; g.fillStyle = GOLD; g.fillText(T(SIGNS[sign].glyph), x, 995);
      g.font = `700 38px ${SERIF}`; g.fillStyle = INK; g.fillText(SIGNS[sign].ko, x, 1050);
    });
    g.textAlign = "left";
    g.font = `400 29px ${SERIF}`; g.fillStyle = "rgba(232,233,240,0.9)";
    wrap(g, d.line, 84, 1130, W - 168, 46, 3);
    footer(g, d.footLine);
    return cv;
  }

  /* 미리보기 창: 공유하기 / 이미지 저장 */
  function preview(canvas, filename, title) {
    let dlg = document.getElementById("share-dlg");
    if (!dlg) {
      dlg = document.createElement("div");
      dlg.id = "share-dlg"; dlg.className = "share-dlg"; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true");
      dlg.innerHTML = `<div class="share-box"><p class="share-title"></p><img class="share-img" alt=""><div class="share-actions">
        <button type="button" class="btn btn-ink" data-act="share">공유하기</button>
        <button type="button" class="btn btn-line" data-act="save">이미지 저장</button>
        <button type="button" class="btn btn-line" data-act="close">닫기</button></div>
        <p class="share-note small muted"></p></div>`;
      document.body.appendChild(dlg);
      dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
      addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    }
    const close = () => { dlg.hidden = true; };
    dlg.hidden = false;
    dlg.querySelector(".share-title").textContent = title;
    const url = canvas.toDataURL("image/png");
    const img = dlg.querySelector(".share-img"); img.src = url; img.alt = title;
    const note = dlg.querySelector(".share-note"); note.textContent = "";
    dlg.querySelector('[data-act="close"]').onclick = close;
    dlg.querySelector('[data-act="save"]').onclick = () => { const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); };
    const shareBtn = dlg.querySelector('[data-act="share"]');
    shareBtn.onclick = () => canvas.toBlob(async (blob) => {
      const file = new File([blob], filename, { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "별누리", text: `${title} · ${location.origin}${location.pathname.replace(/[^/]*$/, "")}` });
        else { note.textContent = "이 브라우저는 이미지 공유를 지원하지 않습니다. '이미지 저장' 후 직접 올려 주세요."; }
      } catch (err) { if (err?.name !== "AbortError") note.textContent = "공유하지 못했습니다. '이미지 저장'을 이용해 주세요."; }
    }, "image/png");
    shareBtn.hidden = !navigator.share;
    dlg.querySelector('[data-act="close"]').focus();
  }

  return { today, chart, preview };
})();
