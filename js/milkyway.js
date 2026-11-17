/* 은하수: 실제 은하수 윤곽(d3-celestial mw.json)에서 밝기에 비례해 뽑은 점 (js/milkyway-data.js)
 * [적경°, 적위°, 밝기 0~1, 무작위 0~1] */
const MILKY_WAY = MILKY_WAY_POINTS.map(([ra, dec, v], i) => [ra, dec, v, ((i * 2654435761) >>> 0) / 4294967296]);

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
