/* 은하수: 은하 좌표(l, b)에서 빛 알갱이를 뿌린 뒤 적도 좌표로 바꾼다.
 * 은하 중심(궁수자리, l=0) 쪽이 두껍고 밝으며, 백조자리에서 궁수자리까지 어두운 틈(Great Rift)이 있다. */
const MILKY_WAY = (() => {
  let seed = 4242;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  const D = Math.PI / 180;
  const raG = 192.85948 * D, decG = 27.12825 * D, lNCP = 122.93192 * D;

  const out = [];
  let tries = 0;
  while (out.length < 7000 && tries < 60000) {
    tries++;
    const l = rand() * 360;
    const dl = Math.min(l, 360 - l);                       // 은하 중심에서 떨어진 각도
    const bulge = Math.exp(-((dl / 38) ** 2));
    if (rand() > 0.28 + 0.72 * bulge) continue;            // 중심 쪽에 더 많이
    const width = 3.5 + 7 * bulge;
    const b = gauss() * width;
    const ls = l > 180 ? l - 360 : l;
    // 어두운 틈: l ≈ 0°~80°, b ≈ +1° 근처
    if (ls > -5 && ls < 80 && Math.abs(b - 1.2) < 2.2 && rand() < 0.75) continue;
    // 덩어리 느낌
    const clump = 0.55 + 0.45 * Math.sin(l * 0.21 + Math.cos(b * 0.7) * 2.1) * Math.cos(l * 0.083 + b * 0.3);
    if (rand() > clump) continue;

    const lr = l * D, br = b * D;
    const sinDec = Math.sin(br) * Math.sin(decG) + Math.cos(br) * Math.cos(decG) * Math.cos(lNCP - lr);
    const dec = Math.asin(sinDec);
    const ra = raG + Math.atan2(Math.cos(br) * Math.sin(lNCP - lr), Math.sin(br) * Math.cos(decG) - Math.cos(br) * Math.sin(decG) * Math.cos(lNCP - lr));
    const glow = (0.35 + 0.65 * bulge) * (1 - Math.min(1, Math.abs(b) / (width * 2.2)));
    out.push([((ra / D) % 360 + 360) % 360, dec / D, glow, rand()]);
  }
  return out;
})();

/* 부드러운 빛 알갱이 스프라이트 (drawImage로 빠르게 찍는다) */
function makeGlowSprite(size, rgb) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.4, `rgba(${rgb},0.35)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
