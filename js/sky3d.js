/* 3D 밤하늘 (Three.js)
 * - 올려다보기: 관측자가 지면 위에 서서 하늘을 둘러본다. 대기 때문에 별이 반짝이고 지평선 근처는 흐리다.
 * - 입체 우주: 별을 실제 거리(광년)로 옮겨, 별자리가 사실은 거리가 제각각인 별들의 겹침이라는 걸 보여 준다.
 * 좌표계: +x = 동쪽, +y = 천정, -z = 북쪽
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const R = 1000;          // 천구 반지름
const LY = 3.3;          // 1광년 = 3.3 단위 (300광년 ≈ 천구 반지름)
const D2R = Math.PI / 180;

const dirFromAltAz = (alt, az, out = new THREE.Vector3()) => {
  const a = az * D2R, h = alt * D2R;
  return out.set(Math.sin(a) * Math.cos(h), Math.sin(h), -Math.cos(a) * Math.cos(h));
};

const STAR_VS = `
attribute vec3 dir; attribute float dist; attribute float mag; attribute vec3 color; attribute float phase;
uniform float uMorph, uTime, uPx, uFovScale, uMagLimit, uVis;
varying vec3 vColor; varying float vAlpha;
void main() {
  float d = dist > 0.0 ? dist : ${(3000 * LY).toFixed(1)};
  vec3 p = dir * mix(${R.toFixed(1)}, d, uMorph);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float alt = dir.y;
  float ext = mix(step(-0.02, alt) * clamp(0.3 + alt * 3.5, 0.0, 1.0), 1.0, uMorph);
  float lim = mix(uMagLimit, 6.5, uMorph);
  float vis = clamp((lim - mag) / 1.1, 0.0, 1.0);
  float size = max(3.0, (6.6 - mag) * 2.9) * uFovScale;
  float tw = 1.0 + (1.0 - uMorph) * 0.28 * sin(uTime * (1.7 + phase * 3.1) + phase * 37.0) * clamp(1.1 - alt, 0.25, 1.0);
  gl_PointSize = size * tw * uPx;
  vColor = color;
  vAlpha = vis * ext * mix(uVis, 1.0, uMorph) * ((dist > 0.0 || uMorph < 0.5) ? 1.0 : 0.0);
}`;
const STAR_FS = `
varying vec3 vColor; varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float core = 1.0 - smoothstep(0.05, 0.3, r);
  float halo = exp(-r * r * 7.0) * 0.8 + exp(-r * r * 2.2) * 0.18;
  gl_FragColor = vec4(vColor * (core + halo) * vAlpha, 1.0);
}`;

const MW_VS = `
attribute vec3 dir; attribute float glow; attribute float rnd;
uniform float uMorph, uPx, uFovScale, uVis;
varying float vA; varying float vR;
void main() {
  vec3 p = dir * mix(${(R * 1.02).toFixed(1)}, ${(R * 40).toFixed(1)}, uMorph);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (14.0 + rnd * 22.0) * uFovScale * uPx;
  float ext = mix(clamp(dir.y * 5.0, 0.0, 1.0), 1.0, uMorph);
  vA = glow * uVis * ext; vR = rnd;
}`;
const MW_FS = `
varying float vA; varying float vR;
void main() {
  vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float g = exp(-r * r * 4.0);
  vec3 col = mix(vec3(0.75, 0.78, 0.95), vec3(1.0, 0.9, 0.78), vR);
  gl_FragColor = vec4(col * g * vA * 0.16, 1.0);
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
uniform vec3 uSun; uniform float uGlow, uMorph;
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
  gl_FragColor = vec4(col * (1.0 - uMorph), 1.0);
}`;

export class Sky3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts;
    this.mode = "explore"; this.showLines = true; this.showNames = true;
    this.discovered = new Set(); this.selected = null; this.hint = null; this.flash = null;
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
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.1, 400000);
    this.controls = new OrbitControls(this.camera, this.overlay);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.enablePan = false;

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
      uMagLimit: { value: 6 }, uVis: { value: 1 },
    };
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VS, fragmentShader: STAR_FS, uniforms: this.uniforms,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.renderOrder = 3; this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // 은하수
    const m = MILKY_WAY.length;
    this.mwRaDec = MILKY_WAY;
    this.mwDir = new Float32Array(m * 3);
    const glow = new Float32Array(m), rnd = new Float32Array(m);
    MILKY_WAY.forEach(([, , g, r], i) => { glow[i] = g; rnd[i] = r; });
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m * 3), 3));
    mg.setAttribute("dir", new THREE.BufferAttribute(this.mwDir, 3));
    mg.setAttribute("glow", new THREE.BufferAttribute(glow, 1));
    mg.setAttribute("rnd", new THREE.BufferAttribute(rnd, 1));
    this.mwUniforms = { uMorph: this.uniforms.uMorph, uPx: this.uniforms.uPx, uFovScale: this.uniforms.uFovScale, uVis: { value: 1 } };
    this.mw = new THREE.Points(mg, new THREE.ShaderMaterial({
      vertexShader: MW_VS, fragmentShader: MW_FS, uniforms: this.mwUniforms,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.mw.renderOrder = 2; this.mw.frustumCulled = false;
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
    this.skyUniforms = { uSun: { value: new THREE.Vector3(0, -1, 0) }, uGlow: { value: 0 }, uMorph: this.uniforms.uMorph };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(R * 60, 48, 24), new THREE.ShaderMaterial({
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
    this.home = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.home.scale.setScalar(60);
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
    this.mwRaDec.forEach(([ra, dec], i) => {
      const aa = toAltAz(ra, dec, place.lat, lst);
      dirFromAltAz(aa.alt, aa.az, tmp);
      this.mwDir.set([tmp.x, tmp.y, tmp.z], i * 3);
    });
    this.mw.geometry.attributes.dir.needsUpdate = true;

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
    const moon = moonPosition(time), ma = toAltAz(moon.ra, moon.dec, place.lat, lst);
    this.moonAA = { ...ma, ...moon };
    this.moon.position.copy(dirFromAltAz(ma.alt, ma.az)).multiplyScalar(R * 0.97);
    this.paintMoon(moon);
    this.applyConditions();
    this.updateLineColors();
  }

  applyConditions() {
    const t = Math.max(0, Math.min(1, (this.sunAA.alt + 18) / 18));
    const city = this.skyCondition === "city";
    this.uniforms.uVis.value = this.sunAA.alt > 0 ? 0.05 : 1 - t * 0.8;
    this.uniforms.uMagLimit.value = (city ? 3.4 : 6.0) - t * 3;
    this.mwUniforms.uVis.value = city ? 0 : Math.max(0, 1 - t * 1.6);
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
  setZoom(z) { this.fov = Math.max(18, Math.min(110, 75 / z)); }
  get zoom() { return 75 / this.fov; }

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

  starPos(i, out = new THREE.Vector3()) {
    const d = this.starDist[i] > 0 ? this.starDist[i] : 3000 * LY;
    return out.fromArray(this.starDir, i * 3).multiplyScalar(R + (d - R) * this.morph);
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
          this.fov = Math.max(18, Math.min(110, drag.fov0 * (drag.pinch / this.pinchDist(pointers))));
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
      this.fov = Math.max(18, Math.min(110, this.fov * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
    }, { passive: false });
    el.tabIndex = 0;
    el.setAttribute("aria-label", "3D 밤하늘. 화살표 키로 둘러보고, +와 -로 확대합니다.");
    el.addEventListener("keydown", (e) => {
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

  pinchDist(p) { const [a, b] = [...p.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  /* 화면 좌표 → [x, y] (보이지 않으면 null) */
  toScreen(v) {
    const p = v.clone().applyMatrix4(this.camera.matrixWorldInverse);
    if (p.z > -0.1) return null;
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
      text = `${STAR_KO[s.name] || s.name}${ly ? `, ${ly.toLocaleString("ko-KR")}광년` : ""}${text ? ` (${text})` : ""}`;
    }
    this.overlay.style.cursor = c ? "pointer" : this.controls.enabled ? "grab" : "move";
    this.opts.onHover?.(text ? { text, x, y } : null);
  }

  handleClick(x, y) {
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
    this.updateLineColors();
    this.opts.onSelect?.(c);
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
    this.morph = Math.abs(dm) < 0.002 ? this.morphTarget : this.morph + dm * (this.reduceMotion ? 1 : 0.045);
    this.uniforms.uMorph.value = this.morph;
    this.ground.visible = this.morph < 0.05;
    this.sun.visible = this.morph < 0.3 && this.sunAA?.alt > -2;
    this.moon.visible = this.morph < 0.3 && this.moonAA?.alt > -2;
    this.home.material.opacity = this.morph;

    if (this.tween) {
      const t = this.tween; t.t = Math.min(1, t.t + dt * 1.6);
      const e = 1 - (1 - t.t) ** 3;
      this.yaw = (t.yaw0 + (t.yaw1 - t.yaw0) * e + 360) % 360; this.pitch = t.p0 + (t.p1 - t.p0) * e;
      if (t.t >= 1) this.tween = null;
    }

    const cam = this.camera;
    if (this.orbit) {
      const o = this.orbit; o.t = Math.min(1, o.t + dt * 0.45);
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
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.uniforms.uFovScale.value = Math.pow(60 / cam.fov, 0.45) * (this.overlay.clientWidth < 600 ? 0.85 : 1);
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
        const named = SKY_NAMED.find((n) => n[1] === i);
        const text = `${named ? `${STAR_KO[named[0]] || named[0]} ` : ""}${ly.toLocaleString("ko-KR")}광년`;
        const w = g.measureText(text).width;
        if (!fits(s[0] + 8 + w / 2, s[1] - 9, w, fs)) continue;
        g.fillStyle = "rgba(247,222,154,0.9)";
        g.fillText(text, s[0] + 8, s[1] - 9);
      }
      const h = this.toScreen(new THREE.Vector3());
      if (h) { g.fillStyle = "rgba(255,226,160,0.95)"; g.fillText("태양과 지구", h[0] + 10, h[1]); }
    } else if (!in3D && this.showNames && this.mode === "explore" && this.uniforms.uVis.value > 0.3) {
      for (const [name, i] of SKY_NAMED) {
        if (this.starAA[i].alt < 3 || SKY_STARS[i][2] > (this.camera.fov < 45 ? 1.8 : 1.1)) continue;
        const s = this.toScreen(this.starPos(i, v));
        if (!s) continue;
        const text = STAR_KO[name] || name, w = g.measureText(text).width;
        if (!fits(s[0] + 8 + w / 2, s[1] - 9, w, fs)) continue;
        g.fillStyle = "rgba(200,212,240,0.75)";
        g.fillText(text, s[0] + 8, s[1] - 9);
      }
    }
    if (!in3D && this.moonAA?.alt > 0) {
      const s = this.toScreen(this.moon.position.clone());
      if (s) { g.textAlign = "center"; g.fillStyle = "rgba(244,239,217,0.85)"; g.fillText("달", s[0], s[1] + 26); }
    }
  }
}
