/* 페이지 배경: 오늘 밤 9시 서울 머리 위의 실제 별과 은하수를 한 번 그린다. */
(function () {
  const cv = document.getElementById("backdrop");
  if (!cv || typeof SKY_STARS === "undefined") return;
  const ctx = cv.getContext("2d");
  const now = new Date();
  // 오늘 저녁 9시 (한국 시간)
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  const lat = 37.57, lst = localSiderealDeg(t, 126.98);
  const stars = SKY_STARS.map(([ra, dec, mag, bv]) => ({ ...toAltAz(ra, dec, lat, lst), mag, bv }));
  const mw = MILKY_WAY.map(([ra, dec, g, r]) => ({ ...toAltAz(ra, dec, lat, lst), g, r }));
  const sprite = makeGlowSprite(64, "205,210,240");

  function paint() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#03050C"; ctx.fillRect(0, 0, W, H);
    // 화면을 덮는 입체 투영 (천정이 화면 가운데 위쪽)
    const R = Math.hypot(W, H) * 0.62, cx = W / 2, cy = H * 0.42;
    const proj = (alt, az) => {
      const r = R * Math.tan(((90 - alt) / 2) * DEG), a = az * DEG;
      return [cx - r * Math.sin(a), cy - r * Math.cos(a)];
    };
    ctx.globalCompositeOperation = "lighter";
    for (const p of mw) {
      if (p.alt < -20) continue;
      const [x, y] = proj(p.alt, p.az);
      const s = 26 + p.r * 40;
      ctx.globalAlpha = p.g * 0.05;
      ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
    }
    for (const s of stars) {
      if (s.alt < -20) continue;
      const [x, y] = proj(s.alt, s.az);
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      const [r, g, b] = starColor(s.bv);
      const rad = Math.max(0.4, (5.6 - s.mag) * 0.42);
      ctx.globalAlpha = Math.min(1, 0.25 + (5.5 - s.mag) * 0.16);
      if (s.mag < 1.8) {
        const gl = ctx.createRadialGradient(x, y, 0, x, y, rad * 5);
        gl.addColorStop(0, `rgba(${r},${g},${b},0.35)`); gl.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, rad * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  paint();
  let raf;
  addEventListener("resize", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); });
})();
