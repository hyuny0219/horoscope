/* 3D 밤하늘 (Three.js)
 * - 올려다보기: 관측자가 지면 위에 서서 하늘을 둘러본다. 대기 때문에 별이 반짝이고 지평선 근처는 흐리다.
 * - 입체 우주: 별을 실제 거리(광년)로 옮겨, 별자리가 사실은 거리가 제각각인 별들의 겹침이라는 걸 보여 준다.
 * 좌표계: +x = 동쪽, +y = 천정, -z = 북쪽
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const R = 1000;          // 천구 반지름
const LY = 3.3;          // 1광년 = 3.3 단위 (300광년 ≈ 천구 반지름)
const AU = 0.02;         // 태양계는 보기 좋게 키운다: 1AU = 0.02 단위 (실제 비율이면 해왕성 궤도도 0.0016 단위)
const D2R = Math.PI / 180;

const dirFromAltAz = (alt, az, out = new THREE.Vector3()) => {
  const a = az * D2R, h = alt * D2R;
  return out.set(Math.sin(a) * Math.cos(h), Math.sin(h), -Math.cos(a) * Math.cos(h));
};

/* 별: 등급 1 차이 = 밝기 2.512배. 지평선 쪽은 공기를 더 많이 지나 어두워지고(대기 감광) 더 많이 반짝인다 */
const STAR_VS = `
attribute vec3 dir; attribute float dist; attribute float mag; attribute vec3 color; attribute float phase;
uniform float uMorph, uTime, uPx, uFovScale, uMagLimit, uVis, uGain;
varying vec3 vColor; varying float vLum; varying float vGlare; varying float vCore; varying float vSize;
void main() {
  float d = dist > 0.0 ? dist : ${(3000 * LY).toFixed(1)};
  vec3 p = dir * mix(${R.toFixed(1)}, d, uMorph);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float alt = dir.y;
  float airmass = 1.0 / max(alt + 0.025, 0.04);
  float m = mag + (1.0 - uMorph) * 0.22 * (airmass - 1.0);
  // 입체 우주: 카메라와의 거리로 겉보기 등급을 다시 계산한다 (가까이 가면 밝아진다)
  if (dist > 0.0 && uMorph > 0.01) {
    float dc = max(length(p - cameraPosition), 0.05), de = max(length(p), 0.05);
    m += uMorph * 5.0 * log(dc / de) / log(10.0);
  }
  float lim = mix(uMagLimit, 7.2, uMorph);
  float lb = clamp(-0.4 * (m - lim), 0.0, 7.0);             // 한계 등급보다 몇 자리 밝은가 (log10)
  float vis = (1.0 - smoothstep(-0.3, 0.4, m - lim)) * mix(step(-0.01, alt), 1.0, uMorph);
  vLum = clamp(0.36 + 0.26 * lb, 0.0, 1.3) * vis * mix(uVis, 1.0, uMorph) * uGain;
  if (dist <= 0.0 && uMorph > 0.5) vLum = 0.0;
  float k = uFovScale * uPx;
  float tw = 1.0 + (1.0 - uMorph) * 0.25 * sin(uTime * (1.7 + phase * 3.1) + phase * 37.0) * clamp(airmass * 0.15, 0.15, 1.0);
  vCore = (0.8 + 0.5 * lb) * k * tw * sqrt(uGain);          // 별빛 중심 반지름 (픽셀)
  vGlare = clamp(lb - 1.6, 0.0, 2.2);                        // 1등성 안팎부터 빛 번짐
  vSize = vCore * 4.0 + vGlare * 8.0 * k + 2.0;
  gl_PointSize = vSize;
  vColor = mix(vec3(1.0), color, 0.8);
}`;
const STAR_FS = `
varying vec3 vColor; varying float vLum; varying float vGlare; varying float vCore; varying float vSize;
void main() {
  float rp = length(gl_PointCoord - 0.5) * vSize;            // 중심에서 픽셀 거리
  float core = exp(-(rp * rp) / (vCore * vCore));
  float hr = vSize * 0.22;
  float halo = exp(-(rp * rp) / (hr * hr)) * 0.28 * vGlare;
  float a = core + halo;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a * vLum, 1.0);
}`;

/* 은하수: 실제 윤곽으로 만든 전천 이미지(assets/milkyway.png)를 적도 좌표 구에 입힌다 */
const MW_VS = `
varying vec3 vEq; varying vec3 vWorld;
void main() {
  vEq = normalize(position);
  vWorld = normalize((modelMatrix * vec4(position, 1.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const MW_FS = `
uniform sampler2D uTex; uniform float uVis, uMorph;
varying vec3 vEq; varying vec3 vWorld;
void main() {
  vec3 e = normalize(vEq);
  float u = fract(atan(e.y, e.x) / 6.2831853);
  float v = 0.5 + asin(clamp(e.z, -1.0, 1.0)) / 3.1415927;
  float t = texture2D(uTex, vec2(u, v)).r;
  float ext = mix(smoothstep(0.0, 0.3, vWorld.y), 1.0, uMorph);
  vec3 col = mix(vec3(0.62, 0.66, 0.82), vec3(0.92, 0.86, 0.74), t);
  gl_FragColor = vec4(col * pow(t, 1.15) * 0.42 * uVis * ext, 1.0);
}`;

const LINE_VS = `
attribute vec3 dir; attribute float dist; attribute vec3 lcolor;
uniform float uMorph;
varying vec3 vC;
void main() {
  float d = dist > 0.0 ? dist : ${(3000 * LY).toFixed(1)};
  vec3 p = dir * mix(${(R * 0.999).toFixed(1)}, d, uMorph);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float ext = mix(step(-0.01, dir.y), 1.0, uMorph);
  vC = lcolor * ext;
}`;
const LINE_FS = `varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }`;

const SKY_VS = `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `
varying vec3 vDir;
uniform vec3 uSun; uniform vec3 uMoon; uniform float uGlow, uMorph, uMoonLight;
void main() {
  vec3 v = normalize(vDir);
  float alt = v.y, sunAlt = uSun.y;
  vec3 night = vec3(0.006, 0.009, 0.026);
  float day = smoothstep(-0.3, 0.05, sunAlt);              // 박명 ~ 낮
  vec3 dayCol = mix(vec3(0.04, 0.08, 0.2), vec3(0.32, 0.52, 0.85), smoothstep(-0.05, 0.2, sunAlt));
  vec3 col = mix(night, dayCol, day);
  float band = exp(-max(alt, 0.0) * 9.0);
  col += vec3(0.05, 0.065, 0.11) * band * (1.0 - day);       // 대기광
  col += vec3(0.22, 0.14, 0.07) * band * uGlow * (1.0 - day * 0.7); // 도시 불빛
  float toward = pow(max(dot(v, normalize(uSun)), 0.0), 6.0);
  col += vec3(1.0, 0.55, 0.25) * toward * smoothstep(-0.32, 0.0, sunAlt) * band * 0.9; // 노을
  // 달빛: 하늘 전체가 푸르게 밝아지고 달 둘레가 환하다
  float nearMoon = pow(max(dot(v, normalize(uMoon)), 0.0), 40.0);
  col += (vec3(0.035, 0.05, 0.09) * (0.5 + band) + vec3(0.25, 0.25, 0.28) * nearMoon) * uMoonLight * (1.0 - day);
  gl_FragColor = vec4(col * (1.0 - uMorph), 1.0);
}`;

export class Sky3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts;
    this.mode = "explore"; this.showLines = true; this.showNames = true;
    this.discovered = new Set(); this.selected = null; this.hint = null; this.flash = null;
    this.showStarNames = true; this.selectedStar = null;
    this.skyCondition = "dark";
    this.yaw = 180; this.pitch = 28; this.fov = 75;
    this.morph = 0; this.morphTarget = 0;
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.domElement.className = "gl";
    container.appendChild(this.renderer.domElement);
    this.overlay = document.createElement("canvas");
    this.overlay.className = "gl-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    container.appendChild(this.overlay);
    this.octx = this.overlay.getContext("2d");

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.01, 4000000);
    this.controls = new OrbitControls(this.camera, this.overlay);
    this.controls.enabled = false;
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.08,
      enablePan: true, screenSpacePanning: true, zoomToCursor: true,
      rotateSpeed: 0.55, zoomSpeed: 2.2, panSpeed: 0.9,
      minDistance: 0.0003, maxDistance: 300000, autoRotateSpeed: 0.6,
    });

    this.build();
    this.bindInput();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /* ---------- 장면 만들기 ---------- */
  build() {
    const n = SKY_STARS.length;
    this.starDir = new Float32Array(n * 3);
    const dist = new Float32Array(n), mag = new Float32Array(n), col = new Float32Array(n * 3), phase = new Float32Array(n);
    SKY_STARS.forEach(([, , m, bv, ly], i) => {
      dist[i] = ly * LY; mag[i] = m; phase[i] = Math.random();
      const [r, g, b] = starColor(bv);
      col.set([r / 255, g / 255, b / 255], i * 3);
    });
    this.starDist = dist;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // 사용하지 않지만 three가 요구
    sg.setAttribute("dir", new THREE.BufferAttribute(this.starDir, 3));
    sg.setAttribute("dist", new THREE.BufferAttribute(dist, 1));
    sg.setAttribute("mag", new THREE.BufferAttribute(mag, 1));
    sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    sg.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.uniforms = {
      uMorph: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uFovScale: { value: 1 },
      uMagLimit: { value: 6 }, uVis: { value: 1 }, uGain: { value: 1.35 },
    };
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VS, fragmentShader: STAR_FS, uniforms: this.uniforms,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.renderOrder = 3; this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // 은하수
    const tex = new THREE.TextureLoader().load(new URL("../assets/milkyway.png", import.meta.url).href);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; // 이음매 방지
    this.mwUniforms = { uTex: { value: tex }, uVis: { value: 1 }, uMorph: this.uniforms.uMorph };
    this.mw = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), new THREE.ShaderMaterial({
      vertexShader: MW_VS, fragmentShader: MW_FS, uniforms: this.mwUniforms, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.mw.matrixAutoUpdate = false;
    this.mw.renderOrder = 2; this.mw.frustumCulled = false;
    this.eqToHorizon = new THREE.Matrix4();
    this.scene.add(this.mw);

    // 별자리 선: 선분마다 꼭짓점 두 개
    const pairs = [];
    this.lineOwner = [];
    CONSTELLATIONS.forEach((c, ci) => {
      for (const seg of c.segs) for (let k = 0; k < seg.length - 1; k++) { pairs.push(seg[k], seg[k + 1]); this.lineOwner.push(ci); }
    });
    this.linePairs = pairs;
    const lv = pairs.length;
    this.lineDir = new Float32Array(lv * 3);
    this.lineColor = new Float32Array(lv * 3);
    const ld = new Float32Array(lv);
    pairs.forEach((si, i) => { ld[i] = dist[si]; });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lv * 3), 3));
    lg.setAttribute("dir", new THREE.BufferAttribute(this.lineDir, 3));
    lg.setAttribute("dist", new THREE.BufferAttribute(ld, 1));
    lg.setAttribute("lcolor", new THREE.BufferAttribute(this.lineColor, 3));
    this.lines = new THREE.LineSegments(lg, new THREE.ShaderMaterial({
      vertexShader: LINE_VS, fragmentShader: LINE_FS, uniforms: { uMorph: this.uniforms.uMorph },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.lines.renderOrder = 4; this.lines.frustumCulled = false;
    this.scene.add(this.lines);

    // 하늘(대기)
    this.skyUniforms = { uSun: { value: new THREE.Vector3(0, -1, 0) }, uMoon: { value: new THREE.Vector3(0, -1, 0) }, uMoonLight: { value: 0 }, uGlow: { value: 0 }, uMorph: this.uniforms.uMorph };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(R * 1500, 48, 24), new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false,
    }));
    sky.renderOrder = 0;
    this.scene.add(sky);

    // 땅과 산 능선
    this.ground = new THREE.Group();
    const ridge = [], idx = [];
    const N = 360, rr = R * 0.9;
    for (let i = 0; i <= N; i++) {
      const az = (i / N) * 360;
      const h = 0.5 + 1.1 * (Math.sin(az * D2R * 3) * 0.5 + 0.5) * (Math.sin(az * D2R * 7 + 1.3) * 0.35 + 0.65) + 0.5 * Math.sin(az * D2R * 17 + 0.4) ** 2;
      const top = dirFromAltAz(h, az).multiplyScalar(rr), bottom = dirFromAltAz(-8, az).multiplyScalar(rr);
      ridge.push(top.x, top.y, top.z, bottom.x, bottom.y, bottom.z);
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(ridge, 3));
    rg.setIndex(idx);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x030408, side: THREE.DoubleSide });
    this.ground.add(new THREE.Mesh(rg, groundMat));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(rr * 1.05, 64), groundMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -rr * Math.tan(8 * D2R);
    this.ground.add(floor);
    this.ground.children.forEach((g) => { g.renderOrder = 1; });
    this.scene.add(this.ground);

    // 행성 (올려다보기에서는 별처럼 빛나는 점)
    const np = PLANETS.length;
    this.planetDir = new Float32Array(np * 3);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(np * 3), 3));
    pg.setAttribute("dir", new THREE.BufferAttribute(this.planetDir, 3));
    pg.setAttribute("dist", new THREE.BufferAttribute(new Float32Array(np), 1)); // 0 = 입체 우주에서 숨김
    pg.setAttribute("mag", new THREE.BufferAttribute(new Float32Array(np).fill(99), 1));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PLANETS.flatMap((p) => p.color.map((c) => c / 255))), 3));
    pg.setAttribute("phase", new THREE.BufferAttribute(new Float32Array(np), 1));
    this.planetPts = new THREE.Points(pg, this.starMat);
    this.planetPts.renderOrder = 3; this.planetPts.frustumCulled = false;
    this.scene.add(this.planetPts);

    // 태양계 (입체 우주에서 태양 가까이 가면 보인다). 자식 좌표는 태양 중심 황도 좌표(AU)
    this.solar = new THREE.Group();
    this.solar.matrixAutoUpdate = false;
    this.planetSprites = {};
    this.orbitLines = [];
    const disc = new THREE.CanvasTexture(makeGlowSprite(64, "255,255,255"));
    for (const p of PLANETS) {
      const line = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
        color: new THREE.Color(...p.color.map((c) => c / 255)), transparent: true, opacity: 0.35, depthWrite: false,
      }));
      line.userData.id = p.id;
      this.orbitLines.push(line); this.solar.add(line);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color: new THREE.Color(...p.color.map((c) => c / 255)), sizeAttenuation: false, depthWrite: false, transparent: true }));
      spr.scale.setScalar((0.012 * p.size) / AU); // 부모의 AU 배율을 되돌린다
      this.planetSprites[p.id] = spr; this.solar.add(spr);
    }
    this.solar.visible = false;
    this.scene.add(this.solar);

    // 달
    this.moonCanvas = document.createElement("canvas");
    this.moonCanvas.width = this.moonCanvas.height = 128;
    this.moonTex = new THREE.CanvasTexture(this.moonCanvas);
    this.moonTex.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moonTex, depthWrite: false, transparent: true }));
    this.moon.scale.setScalar(R * 0.045);
    this.moon.renderOrder = 5;
    this.scene.add(this.moon);
    // 해
    const sunTex = new THREE.CanvasTexture(makeGlowSprite(128, "255,226,160"));
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.sun.scale.setScalar(R * 0.18);
    this.sun.renderOrder = 5;
    this.scene.add(this.sun);
    // 입체 우주에서 우리 태양 위치
    this.home = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, sizeAttenuation: false }));
    this.home.scale.setScalar(0.05);
    this.scene.add(this.home);
  }

  /* ---------- 시간과 장소 ---------- */
  set({ place, time }) {
    this.place = place; this.time = time;
    const lst = localSiderealDeg(time, place.lon);
    const tmp = new THREE.Vector3();
    this.starAA = SKY_STARS.map(([ra, dec], i) => {
      const aa = toAltAz(ra, dec, place.lat, lst);
      dirFromAltAz(aa.alt, aa.az, tmp);
      this.starDir.set([tmp.x, tmp.y, tmp.z], i * 3);
      return aa;
    });
    this.stars.geometry.attributes.dir.needsUpdate = true;
    this.linePairs.forEach((si, i) => this.lineDir.set(this.starDir.subarray(si * 3, si * 3 + 3), i * 3));
    this.lines.geometry.attributes.dir.needsUpdate = true;
    // 적도 좌표의 세 축이 지금 하늘 어디를 향하는지로 회전 행렬을 만든다
    const axis = (ra, dec) => { const a = toAltAz(ra, dec, place.lat, lst); return dirFromAltAz(a.alt, a.az); };
    this.eqToHorizon.makeBasis(axis(0, 0), axis(90, 0), axis(0, 90));

    this.consts = CONSTELLATIONS.map((c) => {
      const centers = c.centers.map(([ra, dec]) => toAltAz(ra, dec, place.lat, lst));
      const stars = [...new Set(c.segs.flat())];
      return { ...c, center: centers.reduce((a, b) => (b.alt > a.alt ? b : a)), stars };
    });
    this.constById = Object.fromEntries(this.consts.map((c) => [c.id, c]));

    const sun = sunPosition(time), sa = toAltAz(sun.ra, sun.dec, place.lat, lst);
    this.sunAA = sa;
    dirFromAltAz(sa.alt, sa.az, this.skyUniforms.uSun.value);
    this.sun.position.copy(this.skyUniforms.uSun.value).multiplyScalar(R * 0.98);
    // 행성: 하늘 속 방향과 밝기, 태양계 속 위치와 궤도
    this.planets = planetPositions(time);
    const pmag = this.planetPts.geometry.attributes.mag;
    this.planets.forEach((p, k) => {
      if (p.ra !== undefined) {
        const aa = toAltAz(p.ra, p.dec, place.lat, lst);
        p.alt = aa.alt; p.az = aa.az;
        this.planetDir.set(dirFromAltAz(aa.alt, aa.az, tmp).toArray(), k * 3);
        pmag.array[k] = p.mag;
      }
      this.planetSprites[p.id].position.set(...p.helio);
      const line = this.orbitLines[k], pts = [];
      for (let j = 0; j < 256; j++) pts.push(new THREE.Vector3(...orbitPoint(p.el, (j / 256) * 360)));
      line.geometry.setFromPoints(pts);
    });
    this.planetPts.geometry.attributes.dir.needsUpdate = true; pmag.needsUpdate = true;
    const ecl = new THREE.Matrix4().makeRotationX(23.43928 * D2R);
    this.solar.matrix.copy(this.eqToHorizon).multiply(ecl).multiply(new THREE.Matrix4().makeScale(AU, AU, AU));
    this.solar.matrixWorldNeedsUpdate = true;

    const moon = moonPosition(time), ma = toAltAz(moon.ra, moon.dec, place.lat, lst);
    this.moonAA = { ...ma, ...moon };
    this.moon.position.copy(dirFromAltAz(ma.alt, ma.az)).multiplyScalar(R * 0.97);
    dirFromAltAz(ma.alt, ma.az, this.skyUniforms.uMoon.value);
    this.skyUniforms.uMoonLight.value = moon.illum * Math.max(0, Math.min(1, (ma.alt + 2) / 25));
    this.paintMoon(moon);
    this.applyConditions();
    this.updateLineColors();
  }

  applyConditions() {
    const t = Math.max(0, Math.min(1, (this.sunAA.alt + 18) / 18)); // 0 = 완전한 밤
    const city = this.skyCondition === "city";
    const moon = this.skyUniforms.uMoonLight.value;                  // 0 ~ 1
    this.uniforms.uVis.value = this.sunAA.alt > 0 ? 0.05 : 1 - t * 0.5;
    this.uniforms.uMagLimit.value = (city ? 3.8 : 6.3) - t * 4 - moon * (city ? 0.4 : 1.6);
    this.mwUniforms.uVis.value = city ? 0 : Math.max(0, 1 - t * 1.6) * (1 - moon * 0.85);
    this.skyUniforms.uGlow.value = city ? 1 : 0.15;
  }

  paintMoon(m) {
    const g = this.moonCanvas.getContext("2d"), s = 128, r = 40;
    g.clearRect(0, 0, s, s);
    const halo = g.createRadialGradient(s / 2, s / 2, r * 0.8, s / 2, s / 2, s / 2);
    halo.addColorStop(0, `rgba(240,235,215,${0.25 * m.illum})`); halo.addColorStop(1, "rgba(240,235,215,0)");
    g.fillStyle = halo; g.fillRect(0, 0, s, s);
    g.save(); g.translate(s / 2, s / 2);
    g.fillStyle = "rgba(40,46,66,0.9)"; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    const lit = "#F4EFD9", dark = "rgba(40,46,66,1)";
    // 올려다볼 때 해는 서쪽에 있다. 차오르는 달은 해 쪽(화면 오른쪽, 남쪽을 볼 때)이 밝다
    g.fillStyle = lit; g.beginPath();
    if (m.waxing) g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); else g.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5);
    g.fill();
    g.fillStyle = m.illum > 0.5 ? lit : dark;
    g.beginPath(); g.ellipse(0, 0, Math.abs(1 - 2 * m.illum) * r, r, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    this.moonTex.needsUpdate = true;
  }

  isRevealed(id) { return this.mode === "explore" || this.discovered.has(id); }

  updateLineColors() {
    const gold = [0.78, 0.63, 0.35], bright = [0.97, 0.87, 0.6];
    for (let i = 0; i < this.lineOwner.length; i++) {
      const c = CONSTELLATIONS[this.lineOwner[i]];
      const sel = c.id === this.selected;
      let k = [0, 0, 0];
      if (sel && this.isRevealed(c.id)) k = bright;
      else if (this.morphTarget === 1) k = [0, 0, 0]; // 입체 우주에서는 고른 별자리만
      else if (this.mode === "discover" && this.discovered.has(c.id)) k = gold.map((v) => v * 0.7);
      else if (this.mode === "explore" && this.showLines) k = gold.map((v) => v * 0.42);
      this.lineColor.set(k, i * 6); this.lineColor.set(k, i * 6 + 3);
    }
    this.lines.geometry.attributes.lcolor.needsUpdate = true;
  }

  draw() { this.applyConditions(); this.updateLineColors(); }

  visibleConstellations(minAlt = 10) {
    return (this.consts || []).filter((c) => c.center.alt > minAlt).sort((a, b) => b.center.alt - a.center.alt);
  }

  /* ---------- 카메라 ---------- */
  setBrightness(g) { this.uniforms.uGain.value = g; }

  setZoom(z) {
    if (this.morphTarget === 1) { this.dollyBy(z > this.zoom ? 0.6 : 1 / 0.6); return; }
    this.fov = Math.max(3, Math.min(120, 75 / z));
  }
  get zoom() { return 75 / this.fov; }

  /* 입체 우주 카메라 조작 */
  /* 날아가는 중에 또 누르면 도착할 자리에서 이어서 계산한다 */
  get destination() {
    const o = this.orbit;
    return o && !o.exiting ? { pos: o.to, target: o.target } : { pos: this.camera.position, target: this.controls.target };
  }

  dollyBy(factor) {
    const { pos, target } = this.destination;
    const off = pos.clone().sub(target);
    const len = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, off.length() * factor));
    this.flyTo(target.clone().add(off.setLength(len)), target.clone(), 0.35);
  }

  orbitBy(dAz, dEl) {
    const { pos, target: tgt } = this.destination, off = pos.clone().sub(tgt);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dAz * D2R;
    sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - dEl * D2R));
    this.flyTo(tgt.clone().add(new THREE.Vector3().setFromSpherical(sph)), tgt.clone(), 0.35);
  }

  /* 카메라를 부드럽게 옮긴다 (끝나면 다시 손으로 조작) */
  flyTo(pos, target, seconds = 1.2) {
    const looking = this.orbit && !this.orbit.exiting ? this.orbit.fromTarget.clone().lerp(this.orbit.target, Math.min(1, this.orbit.t)) : this.controls.target.clone();
    this.controls.enabled = false;
    this.orbit = { from: this.camera.position.clone(), fromTarget: looking, to: pos, target, t: this.reduceMotion ? 1 : 0, speed: 1 / seconds };
  }

  /* 고른 별 주위로 날아가기 */
  orbitStar(i) {
    const p = this.starPos(i, new THREE.Vector3(), 1); // 이동이 끝난 뒤의 실제 위치
    const off = this.camera.position.clone().sub(this.controls.target).setLength(Math.max(40, p.length() * 0.15));
    this.selectedStar = i;
    this.flyTo(p.clone().add(off), p, 1.4);
  }

  resetSpaceView() {
    if (this.selected) this.orbitTo(this.selected);
  }

  setAutoRotate(on) { this.controls.autoRotate = on; }

  lookAtConstellation(id) {
    const c = this.constById?.[id];
    if (!c) return;
    if (this.morph > 0.5) { this.orbitTo(id); return; }
    this.turnTo(c.center.az, Math.max(5, Math.min(85, c.center.alt)));
  }

  turnTo(az, alt) {
    let d = ((az - this.yaw) % 360 + 540) % 360 - 180;
    this.tween = { yaw0: this.yaw, yaw1: this.yaw + d, p0: this.pitch, p1: alt, t: this.reduceMotion ? 1 : 0 };
  }

  starPos(i, out = new THREE.Vector3(), morph = this.morph) {
    const d = this.starDist[i] > 0 ? this.starDist[i] : 3000 * LY;
    return out.fromArray(this.starDir, i * 3).multiplyScalar(R + (d - R) * morph);
  }

  centroid3D(id, morph = 1) {
    const c = this.constById[id], v = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (const i of c.stars) {
      if (!(this.starDist[i] > 0)) continue;
      const d = this.starDist[i];
      v.add(p.fromArray(this.starDir, i * 3).multiplyScalar(R + (d - R) * morph)); n++;
    }
    return n ? v.divideScalar(n) : v;
  }

  /* 입체 우주: 별들을 실제 거리로 옮기고, 카메라를 지구에서 비스듬히 빼낸다 */
  enter3D(id) {
    const target = id || this.selected || this.visibleConstellations(20)[0]?.id || "Ori";
    this.selected = target;
    this.morphTarget = 1;
    const ctr = this.centroid3D(target);
    const dist = ctr.length();
    const side = new THREE.Vector3().crossVectors(ctr, new THREE.Vector3(0, 1, 0)).normalize();
    this.orbit = {
      from: this.camera.position.clone(), fromTarget: dirFromAltAz(this.pitch, this.yaw).multiplyScalar(dist),
      to: ctr.clone().add(side.multiplyScalar(dist * 1.15)).add(new THREE.Vector3(0, dist * 0.35, 0)),
      target: ctr, t: this.reduceMotion ? 1 : 0,
    };
    this.updateLineColors();
  }

  orbitTo(id) {
    this.selected = id;
    const ctr = this.centroid3D(id);
    const off = this.camera.position.clone().sub(this.controls.target).setLength(ctr.length() * 1.2);
    this.controls.enabled = false;
    this.orbit = { from: this.camera.position.clone(), fromTarget: this.controls.target.clone(), to: ctr.clone().add(off), target: ctr, t: this.reduceMotion ? 1 : 0 };
    this.updateLineColors();
  }

  exit3D() {
    this.morphTarget = 0;
    this.updateLineColors();
    this.controls.enabled = false;
    this.orbit = { from: this.camera.position.clone(), fromTarget: this.controls.target.clone(), to: new THREE.Vector3(), target: null, t: this.reduceMotion ? 1 : 0, exiting: true };
    if (this.selected && this.constById[this.selected]) {
      const c = this.constById[this.selected];
      this.yaw = c.center.az; this.pitch = Math.max(5, Math.min(85, c.center.alt));
    }
  }

  get is3D() { return this.morphTarget === 1; }

  /* ---------- 입력 ---------- */
  bindInput() {
    const el = this.overlay;
    const pointers = new Map();
    let drag = null;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    el.addEventListener("pointerdown", (e) => {
      pointers.set(e.pointerId, pos(e));
      const [x, y] = pos(e);
      drag = { x, y, sx: x, sy: y, moved: 0, pinch: pointers.size === 2 ? this.pinchDist(pointers) : null, fov0: this.fov };
      if (!this.controls.enabled) el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      const [x, y] = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [x, y]);
      if (drag && !this.controls.enabled) {
        if (pointers.size === 2 && drag.pinch) {
          this.fov = Math.max(3, Math.min(120, drag.fov0 * (drag.pinch / this.pinchDist(pointers))));
          drag.moved = 99; return;
        }
        const dx = x - drag.x, dy = y - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = x; drag.y = y;
        const k = this.fov / this.overlay.clientHeight;
        this.yaw = (this.yaw - dx * k + 360) % 360;
        this.pitch = Math.max(-5, Math.min(90, this.pitch + dy * k));
        this.tween = null;
        return;
      }
      if (drag) { drag.moved += 1; return; }
      this.updateHover(x, y);
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (drag && drag.moved < 6 && pointers.size === 0) this.handleClick(drag.sx, drag.sy);
      if (pointers.size === 0) drag = null;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", () => this.opts.onHover?.(null));
    el.addEventListener("wheel", (e) => {
      if (this.controls.enabled) return;
      e.preventDefault();
      this.fov = Math.max(3, Math.min(120, this.fov * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
    }, { passive: false });
    el.tabIndex = 0;
    el.setAttribute("aria-label", "3D 밤하늘. 화살표 키로 둘러보고, +와 -로 확대합니다.");
    el.addEventListener("dblclick", (e) => {
      if (this.morph < 0.5) return;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const pl = this.nearestPlanet(px, py, 20);
      if (pl) { this.orbitPlanet(pl.id); this.opts.onPlanet?.(pl); return; }
      const i = this.nearestStar(px, py, 24);
      if (i != null) { this.orbitStar(i); this.opts.onStar?.(i); }
    });
    el.addEventListener("keydown", (e) => {
      if (this.morph > 0.5) {
        const k = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
        if (k) this.orbitBy(...k);
        else if (e.key === "+" || e.key === "=") this.dollyBy(0.7);
        else if (e.key === "-") this.dollyBy(1 / 0.7);
        else return;
        e.preventDefault(); return;
      }
      const step = this.fov / 10;
      if (e.key === "ArrowLeft") this.yaw = (this.yaw - step + 360) % 360;
      else if (e.key === "ArrowRight") this.yaw = (this.yaw + step) % 360;
      else if (e.key === "ArrowUp") this.pitch = Math.min(90, this.pitch + step);
      else if (e.key === "ArrowDown") this.pitch = Math.max(-5, this.pitch - step);
      else if (e.key === "+" || e.key === "=") this.setZoom(this.zoom * 1.2);
      else if (e.key === "-") this.setZoom(this.zoom / 1.2);
      else return;
      e.preventDefault();
    });
  }

  /* 행성의 화면 위치: 올려다보기에서는 하늘 속, 입체 우주에서는 태양계 속 */
  planetScreen(p, v = new THREE.Vector3()) {
    if (this.morph < 0.5) {
      if (p.alt === undefined || p.alt < 0) return null;
      return this.toScreen(dirFromAltAz(p.alt, p.az, v).multiplyScalar(R * 0.99));
    }
    if (!this.solar.visible) return null;
    return this.toScreen(v.set(...p.helio).applyMatrix4(this.solar.matrix));
  }

  nearestPlanet(x, y, radius = 16) {
    let best = null, bestD = radius;
    for (const p of this.planets || []) {
      const s = this.planetScreen(p);
      if (!s) continue;
      const d = Math.hypot(s[0] - x, s[1] - y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /* 행성 가까이로 */
  orbitPlanet(id) {
    const p = this.planets.find((q) => q.id === id);
    const pos = new THREE.Vector3(...p.helio).applyMatrix4(this.solar.matrix);
    const off = this.camera.position.clone().sub(this.controls.target).setLength(Math.max(0.004, AU * 0.4));
    this.selectedPlanet = id;
    this.flyTo(pos.clone().add(off), pos, 1.4);
  }

  /* 태양계 전체가 보이는 자리로 */
  goSolarSystem() {
    const up = new THREE.Vector3(0, 0, 1).applyMatrix4(new THREE.Matrix4().extractRotation(this.solar.matrix)); // 황도 북극
    const side = new THREE.Vector3(1, 0, 0).applyMatrix4(new THREE.Matrix4().extractRotation(this.solar.matrix));
    this.flyTo(up.multiplyScalar(0.55).add(side.multiplyScalar(0.55)), new THREE.Vector3(), 1.8);
  }

  pinchDist(p) { const [a, b] = [...p.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  /* 화면 좌표 → [x, y] (보이지 않으면 null) */
  toScreen(v) {
    const p = v.clone().applyMatrix4(this.camera.matrixWorldInverse);
    if (p.z >= 0) return null; // 카메라 뒤
    p.applyMatrix4(this.camera.projectionMatrix);
    if (Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    return [(p.x + 1) / 2 * this.overlay.clientWidth, (1 - p.y) / 2 * this.overlay.clientHeight];
  }

  nearestConstellation(x, y, radius = 18) {
    let best = null, bestD = radius;
    const v = new THREE.Vector3();
    for (const c of this.consts) {
      for (const i of c.stars) {
        if (this.morph < 0.5 && this.starAA[i].alt < 0) continue;
        const s = this.toScreen(this.starPos(i, v));
        if (!s) continue;
        const d = Math.hypot(s[0] - x, s[1] - y);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    return best;
  }

  nearestNamedStar(x, y, radius = 12) {
    let best = null, bestD = radius;
    const v = new THREE.Vector3();
    for (const [name, i] of SKY_NAMED) {
      if (this.morph < 0.5 && this.starAA[i].alt < 0) continue;
      const s = this.toScreen(this.starPos(i, v));
      if (!s) continue;
      const d = Math.hypot(s[0] - x, s[1] - y);
      if (d < bestD) { bestD = d; best = { name, i }; }
    }
    return best;
  }

  updateHover(x, y) {
    const c = this.nearestConstellation(x, y), s = this.nearestNamedStar(x, y);
    let text = null;
    if (c && this.isRevealed(c.id)) text = c.ko;
    if (s && (!c || this.isRevealed(c.id))) {
      const ly = SKY_STARS[s.i][4];
      text = `${starName(s.i)}${ly ? `, ${ly.toLocaleString("ko-KR")}광년` : ""}${text ? ` (${text})` : ""}`;
    }
    this.overlay.style.cursor = c || s ? "pointer" : this.controls.enabled ? "grab" : "move";
    this.opts.onHover?.(text ? { text, x, y } : null);
  }

  /* 화면에 보이는 별 중 가장 가까운 것 (밝은 별에 가중치) */
  nearestStar(x, y, radius = 16, namedOnly = false) {
    let best = null, bestD = radius;
    const v = new THREE.Vector3(), lim = this.morph > 0.5 ? 6 : this.uniforms.uMagLimit.value;
    for (let i = 0; i < SKY_STARS.length; i++) {
      const mag = SKY_STARS[i][2];
      if (mag > lim || (namedOnly && !NAMED_BY_INDEX.has(i)) || (this.morph < 0.5 && this.starAA[i].alt < 0)) continue;
      const s = this.toScreen(this.starPos(i, v));
      if (!s) continue;
      const d = Math.hypot(s[0] - x, s[1] - y) - Math.max(0, 3 - mag) * 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  lookAtStar(i) {
    const aa = this.starAA[i];
    this.selectedStar = i;
    if (this.morph < 0.5) this.turnTo(aa.az, Math.max(5, Math.min(85, aa.alt)));
  }

  handleClick(x, y) {
    const planet = this.nearestPlanet(x, y);
    if (planet) { this.selectedPlanet = planet.id; this.selectedStar = null; this.opts.onPlanet?.(planet); return; }
    this.selectedPlanet = null;
    const star = this.nearestStar(x, y, 16, true); // 별 정보는 이름 있는 별만
    const c = this.nearestConstellation(x, y, 22);
    if (this.mode === "discover") {
      if (!c) { this.opts.onMiss?.(); return; }
      if (!this.discovered.has(c.id)) {
        this.discovered.add(c.id); this.flash = c.id;
        if (this.hint === c.id) this.hint = null;
        this.opts.onDiscover?.(c);
      }
    }
    this.selected = c ? c.id : null;
    this.selectedStar = star;
    this.updateLineColors();
    this.opts.onSelect?.(c);
    if (star != null && (!c || this.isRevealed(c.id))) this.opts.onStar?.(star);
  }

  /* ---------- 매 프레임 ---------- */
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.overlay.width = w * dpr; this.overlay.height = h * dpr;
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.aspect = w / h;
    this.uniforms.uPx.value = Math.min(devicePixelRatio || 1, 2);
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.uniforms.uTime.value += this.reduceMotion ? 0 : dt;
    // 별 이동 (천구 ↔ 실제 거리)
    const dm = this.morphTarget - this.morph;
    this.morph = Math.abs(dm) < 0.003 ? this.morphTarget : this.morph + dm * (this.reduceMotion ? 1 : Math.min(1, dt * 2.6));
    this.uniforms.uMorph.value = this.morph;
    this.ground.visible = this.morph < 0.05;
    this.sun.visible = this.morph < 0.3 && this.sunAA?.alt > -2;
    this.moon.visible = this.morph < 0.3 && this.moonAA?.alt > -2;
    this.home.material.opacity = this.morph;
    const camR = this.camera.position.length();
    this.solar.visible = this.morph > 0.5 && camR < 40;
    if (this.solar.visible) {
      const f = Math.min(1, Math.max(0, (40 - camR) / 25)); // 멀어지면 흐려진다
      this.orbitLines.forEach((l) => { l.material.opacity = 0.35 * f; });
      Object.values(this.planetSprites).forEach((s) => { s.material.opacity = f; });
    }
    this.home.scale.setScalar(this.morph > 0.5 && camR < 40 ? 0.035 : 0.05);
    const mwR = R * (1.5 + 900 * this.morph);
    this.mw.matrix.copy(this.eqToHorizon).multiply(new THREE.Matrix4().makeScale(mwR, mwR, mwR));
    this.mw.matrixWorldNeedsUpdate = true;

    if (this.tween) {
      const t = this.tween; t.t = Math.min(1, t.t + dt * 1.6);
      const e = 1 - (1 - t.t) ** 3;
      this.yaw = (t.yaw0 + (t.yaw1 - t.yaw0) * e + 360) % 360; this.pitch = t.p0 + (t.p1 - t.p0) * e;
      if (t.t >= 1) this.tween = null;
    }

    const cam = this.camera;
    if (this.orbit) {
      const o = this.orbit; o.t = Math.min(1, o.t + dt * (o.speed || 0.45));
      const e = o.t < 0.5 ? 4 * o.t ** 3 : 1 - (-2 * o.t + 2) ** 3 / 2;
      cam.position.lerpVectors(o.from, o.to, e);
      const tgt = o.exiting ? o.fromTarget.clone().lerp(dirFromAltAz(this.pitch, this.yaw).multiplyScalar(R), e) : o.fromTarget.clone().lerp(o.target, e);
      cam.lookAt(tgt);
      if (o.t >= 1) {
        if (o.exiting) { this.orbit = null; cam.position.set(0, 0, 0); }
        else { this.controls.target.copy(o.target); this.controls.enabled = true; this.orbit = null; }
      }
      cam.fov = 60;
    } else if (this.controls.enabled) {
      cam.fov = 60;
      this.controls.update();
    } else {
      cam.position.set(0, 0, 0);
      cam.fov = this.fov;
      cam.up.set(0, 1, 0);
      cam.lookAt(dirFromAltAz(Math.min(89.9, this.pitch), this.yaw));
    }
    // 아주 가까이 다가가도 잘리지 않게 가까운 평면을 거리에 맞춘다
    const near = this.controls.enabled || this.orbit ? Math.max(1e-6, Math.min(0.1, cam.position.distanceTo(this.controls.target) * 0.002)) : 0.01;
    cam.near = near;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.uniforms.uFovScale.value = Math.pow(60 / cam.fov, 0.3) * (this.overlay.clientWidth < 600 ? 0.85 : 1);
    this.renderer.render(this.scene, cam);
    this.drawOverlay();
  }

  drawOverlay() {
    const g = this.octx, W = this.overlay.clientWidth, H = this.overlay.clientHeight;
    g.clearRect(0, 0, W, H);
    if (!this.consts) return;
    const v = new THREE.Vector3();
    const fs = Math.max(12, Math.min(15, W * 0.012));
    const boxes = [];
    const fits = (x, y, w, h) => {
      const b = [x - w / 2 - 4, y - h / 2 - 2, x + w / 2 + 4, y + h / 2 + 2];
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return false;
      boxes.push(b); return true;
    };
    g.textAlign = "center"; g.textBaseline = "middle";
    const in3D = this.morph > 0.5;

    // 방위 (지평선 위)
    if (this.morph < 0.2) {
      g.font = `600 ${fs + 1}px "IBM Plex Sans KR", sans-serif`;
      for (const [label, az] of [["북", 0], ["북동", 45], ["동", 90], ["남동", 135], ["남", 180], ["남서", 225], ["서", 270], ["북서", 315]]) {
        const s = this.toScreen(dirFromAltAz(-2.5, az, v).multiplyScalar(R * 0.85));
        if (!s) continue;
        g.fillStyle = label.length === 1 ? "rgba(247,222,154,0.95)" : "rgba(200,205,220,0.6)";
        g.fillText(label, s[0], s[1]);
        fits(s[0], s[1], 30, fs);
      }
    }

    // 힌트 영역
    if (this.hint && !in3D) {
      const c = this.constById[this.hint];
      const s = c && this.toScreen(dirFromAltAz(c.center.alt, c.center.az, v).multiplyScalar(R));
      if (s) {
        const rad = (18 / this.camera.fov) * H * 0.5;
        g.strokeStyle = "rgba(247,222,154,0.85)"; g.setLineDash([4, 6]); g.lineWidth = 1.5;
        g.beginPath(); g.arc(s[0], s[1], rad, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
    }

    // 별자리 이름
    const minRank = this.camera.fov < 45 ? 3 : 2;
    const list = this.consts
      .filter((c) => this.isRevealed(c.id) && (in3D || c.center.alt > 2))
      .filter((c) => c.id === this.selected || this.mode === "discover" || (this.showNames && c.rank <= minRank && !in3D))
      .sort((a, b) => (b.id === this.selected) - (a.id === this.selected) || a.rank - b.rank);
    for (const c of list) {
      const sel = c.id === this.selected;
      const p = in3D ? this.centroid3D(c.id, this.morph) : dirFromAltAz(c.center.alt, c.center.az, v).multiplyScalar(R);
      const s = this.toScreen(p);
      if (!s) continue;
      g.font = `${sel ? 700 : 400} ${sel ? fs * 1.25 : fs}px "Gowun Batang", serif`;
      const w = g.measureText(c.ko).width;
      if (!fits(s[0], s[1], w, fs * 1.3) && !sel) continue;
      g.fillStyle = sel || c.id === this.flash ? "rgba(247,222,154,1)" : "rgba(230,232,240,0.72)";
      g.fillText(c.ko, s[0], s[1]);
    }

    // 별 이름 (입체 우주에서는 선택한 별자리 별들의 거리)
    g.font = `400 ${fs * 0.85}px "IBM Plex Sans KR", sans-serif`;
    g.textAlign = "left";
    if (in3D && this.selected) {
      const c = this.constById[this.selected];
      for (const i of c.stars) {
        const ly = SKY_STARS[i][4];
        if (!ly) continue;
        const s = this.toScreen(this.starPos(i, v));
        if (!s) continue;
        const nm = starName(i);
        const text = `${nm ? `${nm} ` : ""}${ly.toLocaleString("ko-KR")}광년`;
        const w = g.measureText(text).width;
        if (!fits(s[0] + 8 + w / 2, s[1] - 9, w, fs)) continue;
        g.fillStyle = "rgba(247,222,154,0.9)";
        g.fillText(text, s[0] + 8, s[1] - 9);
      }
      const h = !this.solar.visible && this.toScreen(new THREE.Vector3());
      if (h) { g.fillStyle = "rgba(255,226,160,0.95)"; g.fillText("태양과 지구", h[0] + 10, h[1]); }
    } else if (!in3D && this.showStarNames && this.mode === "explore" && this.uniforms.uVis.value > 0.3) {
      // 확대할수록 더 어두운 별의 이름까지 보여 준다
      const magCut = Math.min(this.uniforms.uMagLimit.value, this.camera.fov < 25 ? 4 : this.camera.fov < 45 ? 2.6 : this.camera.fov < 70 ? 1.6 : 1.1);
      for (const [, i] of SKY_NAMED) {
        if (this.starAA[i].alt < 3 || SKY_STARS[i][2] > magCut) continue;
        const s = this.toScreen(this.starPos(i, v));
        if (!s) continue;
        const text = starName(i), w = g.measureText(text).width;
        if (!fits(s[0] + 8 + w / 2, s[1] - 9, w, fs)) continue;
        g.fillStyle = "rgba(200,212,240,0.75)";
        g.fillText(text, s[0] + 8, s[1] - 9);
      }
    }
    // 행성 이름 (올려다보기: 하늘에 뜬 행성 / 입체 우주: 태양계 안)
    g.textAlign = "left";
    g.font = `600 ${fs * 0.9}px "IBM Plex Sans KR", sans-serif`;
    for (const p of this.planets || []) {
      const s = this.planetScreen(p, v);
      if (!s) continue;
      const text = p.id === "earth" ? "지구 (우리)" : p.ko;
      g.fillStyle = p.id === this.selectedPlanet ? "rgba(247,222,154,1)" : "rgba(255,214,150,0.9)";
      if (p.id === this.selectedPlanet) { g.strokeStyle = "rgba(247,222,154,0.95)"; g.lineWidth = 1.5; g.beginPath(); g.arc(s[0], s[1], 11, 0, Math.PI * 2); g.stroke(); }
      g.fillText(text, s[0] + 10, s[1] - 8);
    }
    if (this.solar.visible) {
      const s = this.toScreen(new THREE.Vector3());
      if (s) { g.fillStyle = "rgba(255,226,160,0.95)"; g.fillText("태양", s[0] + 12, s[1] + 4); }
    }

    // 고른 별 표시
    if (this.selectedStar != null) {
      const s = this.toScreen(this.starPos(this.selectedStar, v));
      if (s) {
        g.strokeStyle = "rgba(247,222,154,0.95)"; g.lineWidth = 1.5;
        g.beginPath(); g.arc(s[0], s[1], 11, 0, Math.PI * 2); g.stroke();
        g.textAlign = "left"; g.fillStyle = "rgba(247,222,154,1)";
        g.font = `600 ${fs}px "IBM Plex Sans KR", sans-serif`;
        g.fillText(starInfo(this.selectedStar).name, s[0] + 15, s[1] + 1);
      }
    }
    if (!in3D && this.moonAA?.alt > 0) {
      const s = this.toScreen(this.moon.position.clone());
      if (s) { g.textAlign = "center"; g.fillStyle = "rgba(244,239,217,0.85)"; g.fillText("달", s[0], s[1] + 26); }
    }
  }
}
