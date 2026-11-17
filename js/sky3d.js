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
/* 행성·태양 반지름 (AU). 행성끼리의 크기 비율은 실제와 같고(목성 = 지구의 11.2배), 전체를 키웠다.
 * 태양만 실제(지구의 109배)로 그리면 수성 궤도를 삼키므로 작게 그린다. */
const BODY_R = { sun: 0.12, mercury: 0.0077, venus: 0.019, earth: 0.02, mars: 0.0106, jupiter: 0.224, saturn: 0.189, uranus: 0.08, neptune: 0.078 };
const MOON_R = 0.0054, MOON_DIST = 0.13;   // 달 (지구 반지름의 0.27배). 거리는 보기 좋게 줄였다
const TILT = { earth: 23.44, mars: 25.2, jupiter: 3.1, saturn: 26.7, uranus: 97.8, neptune: 28.3, venus: 177.4, mercury: 0.03 };
const SPIN = { mercury: 0.02, venus: -0.02, mars: 0.25, jupiter: 0.6, saturn: 0.55, uranus: -0.35, neptune: 0.4 }; // 보기용 자전 속도 (rad/s)
const ECL = 23.43928 * D2R;
/* 실제 행성 지도 (Solar System Scope, CC BY 4.0, NASA 자료 기반) */
const TEX_URL = (name) => new URL(`../assets/planets/${name}`, import.meta.url).href;
const TEX_FILES = {
  sun: ["sun.jpg"], mercury: ["mercury.jpg"], venus: ["venus.jpg"], earth: ["earth.jpg", "earth-night.jpg", "earth-clouds.jpg"],
  moon: ["moon.jpg"], mars: ["mars.jpg"], jupiter: ["jupiter.jpg"], saturn: ["saturn.jpg", "saturn-ring.png"], uranus: ["uranus.jpg"], neptune: ["neptune.jpg"],
};
/* 가장자리 대기 빛 [r, g, b, 세기] */
const ATMO = { earth: [0.35, 0.62, 1.0, 1.1], venus: [1.0, 0.88, 0.62, 0.7], mars: [1.0, 0.62, 0.42, 0.35], jupiter: [0.95, 0.88, 0.75, 0.3], saturn: [0.98, 0.9, 0.7, 0.28], uranus: [0.62, 0.92, 1.0, 0.5], neptune: [0.42, 0.62, 1.0, 0.55] };

const BODY_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
/* 햇빛(태양 = 원점)을 받는 행성 표면. 지구는 밤쪽 도시 불빛과 바다 반사까지 */
const PLANET_FS = `
uniform sampler2D uDay; uniform sampler2D uNight; uniform float uEarth; uniform float uAmbient;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() {
  vec3 N = normalize(vN), L = normalize(-vP), V = normalize(cameraPosition - vP);
  float d = dot(N, L), lit = max(d, 0.0);
  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 col = day * (uAmbient + 1.2 * lit);
  if (uEarth > 0.5) {
    vec3 night = texture2D(uNight, vUv).rgb;
    col += night * vec3(1.0, 0.85, 0.6) * (1.0 - smoothstep(-0.22, 0.1, d)) * 2.2;
    float ocean = smoothstep(0.03, 0.15, day.b - max(day.r, day.g));
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.93, 0.8) * pow(max(dot(N, H), 0.0), 70.0) * ocean * lit * 0.9;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const CLOUD_FS = `
uniform sampler2D uClouds;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() {
  vec3 N = normalize(vN), L = normalize(-vP);
  float a = texture2D(uClouds, vUv).r;
  float lit = max(dot(N, L), 0.0);
  gl_FragColor = vec4(vec3(0.02 + 1.05 * lit), a * 0.95);
  #include <colorspace_fragment>
}`;
/* 대기: 가장자리로 갈수록 밝은 빛 (햇빛 받는 쪽만) */
const ATMO_FS = `
uniform vec3 uColor; uniform float uStrength;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() {
  vec3 N = normalize(vN), L = normalize(-vP), V = normalize(cameraPosition - vP);
  float rim = 1.0 - max(dot(N, V), 0.0);
  float day = smoothstep(-0.35, 0.35, dot(N, L));
  gl_FragColor = vec4(uColor * pow(rim, 2.8) * uStrength * (0.08 + 0.92 * day), 1.0);
}`;
/* 토성 고리: 안쪽에서 바깥쪽 지도, 토성 그림자, 햇빛 반대편에서 보면 어둡게 */
const RING_FS = `
uniform sampler2D uRing; uniform vec3 uCenter; uniform float uR; uniform vec3 uNormal;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() {
  vec4 t = texture2D(uRing, vec2(vUv.x, 0.5));
  vec3 L = normalize(-vP), V = normalize(cameraPosition - vP);
  float k = 1.0;
  vec3 c = uCenter - vP; float tt = dot(c, L);
  if (tt > 0.0 && length(c - L * tt) < uR) k = 0.06;          // 토성 그림자
  if (dot(uNormal, L) * dot(uNormal, V) < 0.0) k *= 0.45;     // 고리 뒷면
  gl_FragColor = vec4(t.rgb * k * 1.1, t.a);
  #include <colorspace_fragment>
}`;
const SUN_FS = `
uniform sampler2D uDay;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float mu = max(dot(N, V), 0.0);
  vec3 col = texture2D(uDay, vUv).rgb * (0.45 + 0.75 * pow(mu, 0.45)) * 1.6; // 가장자리 어두워짐
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/* 지도가 오기 전에 쓰는 한 가지 색 */
function solidTexture([r, g, b]) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

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
      enablePan: true, screenSpacePanning: true, zoomToCursor: false, // 확대해도 초점(대상)이 화면 가운데에 머문다
      rotateSpeed: 0.55, zoomSpeed: 2.2, panSpeed: 0.9,
      minDistance: 1e-7, maxDistance: 1500 * LY, autoRotateSpeed: 0.6,
      enableZoom: false, // 확대는 직접: 가리키는 곳으로, 가까운 천체에 끌려 들어가게 (zoomAt)
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
    this.planetMeshes = {};
    this.orbitLines = [];
    const disc = new THREE.CanvasTexture(makeGlowSprite(64, "255,255,255"));
    const sphere = new THREE.SphereGeometry(1, 96, 48);
    this.bodyMats = {};   // 지도를 받으면 바꿔 끼울 재질
    const bodyMat = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: BODY_VS, fragmentShader: fs, uniforms, ...extra });
    const atmo = (id, scale) => {
      const [r, g, b, k] = ATMO[id];
      const m = new THREE.Mesh(sphere, bodyMat(ATMO_FS, { uColor: { value: new THREE.Vector3(r, g, b) }, uStrength: { value: k } },
        { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      m.scale.setScalar(scale); m.renderOrder = 7;
      return m;
    };
    for (const p of PLANETS) {
      const line = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
        color: new THREE.Color(...p.color.map((c) => c / 255)), transparent: true, opacity: 0.35, depthWrite: false,
      }));
      line.userData.id = p.id;
      this.orbitLines.push(line); this.solar.add(line);
      // 멀리서는 빛나는 점, 가까이 가면 햇빛을 받는 공으로 보인다
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color: new THREE.Color(...p.color.map((c) => c / 255)), sizeAttenuation: false, depthWrite: false, transparent: true }));
      spr.scale.setScalar((0.012 * p.size) / AU); // 부모의 AU 배율을 되돌린다
      spr.renderOrder = 6;
      this.planetSprites[p.id] = spr; this.solar.add(spr);

      const body = new THREE.Group();
      body.scale.setScalar(BODY_R[p.id]);
      // 황도 좌표는 z가 북쪽. 구의 극(y축)을 자전축 기울기만큼 눕혀 z 쪽으로 세운다
      body.rotation.set(Math.PI / 2 - (TILT[p.id] || 0) * D2R, 0, 0);
      const earth = p.id === "earth";
      const u = { uDay: { value: solidTexture(p.color) }, uNight: { value: solidTexture([0, 0, 0]) }, uEarth: { value: earth ? 1 : 0 }, uAmbient: { value: 0.035 } };
      this.bodyMats[p.id] = u;
      body.add(new THREE.Mesh(sphere, bodyMat(PLANET_FS, u)));
      if (earth) {
        const cu = { uClouds: { value: solidTexture([0, 0, 0]) } };
        this.bodyMats.earthClouds = cu;
        const clouds = new THREE.Mesh(sphere, bodyMat(CLOUD_FS, cu, { transparent: true, depthWrite: false }));
        clouds.scale.setScalar(1.012); clouds.renderOrder = 6;
        body.userData.clouds = clouds;
        body.add(clouds);
      }
      if (ATMO[p.id]) body.add(atmo(p.id, earth ? 1.045 : p.id === "venus" ? 1.04 : 1.025));
      if (p.id === "saturn") {
        // 고리: 안쪽 1.11 ~ 바깥 2.33 (토성 반지름 기준). uv.x = 안쪽에서 바깥쪽
        const RI = 1.11, RO = 2.33, ring = new THREE.RingGeometry(RI, RO, 160, 1);
        const pos = ring.attributes.position, uv = ring.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - RI) / (RO - RI), 0.5);
        const ru = { uRing: { value: solidTexture([0, 0, 0]) }, uCenter: { value: new THREE.Vector3() }, uR: { value: 1 }, uNormal: { value: new THREE.Vector3(0, 1, 0) } };
        this.bodyMats.saturnRing = ru;
        const rm = new THREE.Mesh(ring, bodyMat(RING_FS, ru, { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        rm.rotation.x = Math.PI / 2; // 적도면에 눕힌다
        rm.renderOrder = 5;
        this.saturnRing = rm;
        body.add(rm);
      }
      this.planetMeshes[p.id] = body; this.solar.add(body);
    }
    // 달 (지구 둘레, 실제 방향과 위상)
    this.moonBody = new THREE.Group();
    this.moonBody.rotation.order = "ZYX";
    this.moonBody.scale.setScalar(MOON_R);
    this.bodyMats.moon = { uDay: { value: solidTexture([170, 168, 160]) }, uNight: { value: solidTexture([0, 0, 0]) }, uEarth: { value: 0 }, uAmbient: { value: 0.02 } };
    this.moonBody.add(new THREE.Mesh(sphere, bodyMat(PLANET_FS, this.bodyMats.moon)));
    this.solar.add(this.moonBody);
    // 태양: 실제 표면 지도 + 빛무리
    const sunGlowTex = new THREE.CanvasTexture(makeGlowSprite(128, "255,214,140"));
    this.bodyMats.sun = { uDay: { value: solidTexture([255, 200, 110]) } };
    this.sunBody = new THREE.Mesh(sphere, bodyMat(SUN_FS, this.bodyMats.sun));
    this.sunBody.scale.setScalar(BODY_R.sun);
    this.solar.add(this.sunBody);
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.sunGlow.scale.setScalar(BODY_R.sun * 9);
    this.sunGlow.renderOrder = 6;
    this.solar.add(this.sunGlow);
    this.texLoaded = new Set();
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
      this.planetMeshes[p.id].position.set(...p.helio);
      // 지구는 관측 시각의 실제 자전 각도: 그리니치가 바라보는 적경 = 그리니치 항성시
      if (p.id === "earth") this.planetMeshes.earth.rotation.y = localSiderealDeg(time, 0) * D2R;
      const line = this.orbitLines[k], pts = [];
      for (let j = 0; j < 256; j++) pts.push(new THREE.Vector3(...orbitPoint(p.el, (j / 256) * 360)));
      line.geometry.setFromPoints(pts);
    });
    this.planetPts.geometry.attributes.dir.needsUpdate = true; pmag.needsUpdate = true;
    const ecl = new THREE.Matrix4().makeRotationX(23.43928 * D2R);
    this.solar.matrix.copy(this.eqToHorizon).multiply(ecl).multiply(new THREE.Matrix4().makeScale(AU, AU, AU));
    this.solar.matrixWorldNeedsUpdate = true;

    const moon = moonPosition(time), ma = toAltAz(moon.ra, moon.dec, place.lat, lst);
    {
      // 태양계 속 달: 지구에서 본 실제 방향(적경·적위 → 황도 좌표)에 둔다. 같은 면이 늘 지구를 향한다
      const ra = moon.ra * D2R, dec = moon.dec * D2R;
      const ex = Math.cos(dec) * Math.cos(ra), ey = Math.cos(dec) * Math.sin(ra), ez = Math.sin(dec);
      const v = new THREE.Vector3(ex, ey * Math.cos(ECL) + ez * Math.sin(ECL), -ey * Math.sin(ECL) + ez * Math.cos(ECL));
      const e = this.planets.find((q) => q.id === "earth").helio;
      this.moonBody.position.set(...e).addScaledVector(v, MOON_DIST);
      this.moonBody.rotation.set(Math.PI / 2, 0, Math.atan2(-v.y, -v.x));
    }
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
    if (this.morphTarget === 1) {
      if (!this.controls.enabled) { this.dollyBy(z > this.zoom ? 0.4 : 1 / 0.4); return; }
      // 버튼은 회전 중심 쪽으로. 화면 가운데 가까이 태양이나 행성이 있으면 그쪽으로 끌려간다
      const W = this.overlay.clientWidth, H = this.overlay.clientHeight;
      const c = this.toScreen(this.controls.target);
      this.zoomAt(c ? c[0] : W / 2, c ? c[1] : H / 2, z > this.zoom ? 0.35 : 1 / 0.35);
      return;
    }
    this.fov = Math.max(3, Math.min(120, 75 / z));
  }
  get zoom() { return 75 / this.fov; }

  /* 입체 우주 카메라 조작 */
  /* 날아가는 중에 또 누르면 도착할 자리에서 이어서 계산한다 */
  get destination() {
    const o = this.orbit;
    return o && !o.exiting ? { pos: o.to, target: o.target } : { pos: this.camera.position, target: this.controls.target };
  }

  /* 지금 초점을 맞춘 대상에 다가갈 수 있는 가장 가까운 거리 */
  get minDistFor() {
    const f = this.focus;
    if (!f || !f.radius) return 0.0004;
    // 가장 가까이 가도 행성 둘레가 화면 위아래(세로 화면은 좌우를 조금 넘는 정도)에 남게
    return this.minDistForBody(f.id, f.radius);
  }

  dollyBy(factor) {
    const { pos, target } = this.destination;
    const off = pos.clone().sub(target);
    const len = Math.max(this.minDistFor, Math.min(this.controls.maxDistance, off.length() * factor));
    this.flyTo(target.clone().add(off.setLength(len)), target.clone(), 0.45, this.focus);
  }

  orbitBy(dAz, dEl) {
    const { pos, target: tgt } = this.destination, off = pos.clone().sub(tgt);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dAz * D2R;
    sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - dEl * D2R));
    this.flyTo(tgt.clone().add(new THREE.Vector3().setFromSpherical(sph)), tgt.clone(), 0.45, this.focus);
  }

  /* 카메라를 부드럽게 옮긴다 (끝나면 다시 손으로 조작).
   * 먼저 새 대상 쪽으로 고개를 돌리고, 대상과의 거리는 로그 비율로 줄이거나 늘린다.
   * 그래서 수천 광년에서 행성 앞까지 가도 처음엔 빠르고 도착할 땐 천천히 멈춘다. */
  flyTo(pos, target, seconds, focus = null) {
    const looking = this.orbit && !this.orbit.exiting ? (this.orbit.look || this.orbit.target).clone() : this.controls.target.clone();
    const from = this.camera.position.clone();
    if (seconds == null) {
      const a = Math.max(1e-6, from.distanceTo(target)), b = Math.max(1e-6, pos.distanceTo(target));
      seconds = Math.max(0.9, Math.min(3.2, 0.9 + 0.22 * Math.abs(Math.log(a / b)) + Math.min(1, looking.distanceTo(target) / Math.max(a, 1e-6)) * 0.6));
    }
    this.controls.enabled = false;
    this.focus = focus;
    this.zoomQ = null;
    this.orbit = { from, fromTarget: looking, to: pos, target, t: this.reduceMotion ? 1 : 0, speed: 1 / seconds };
  }

  /* 비행 중 한 프레임: 위치와 바라보는 곳 */
  stepFlight(o, t) {
    const e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    const tgt = o.target;
    const a = o.from.clone().sub(tgt), b = o.to.clone().sub(tgt);
    const dA = Math.max(a.length(), 1e-9), dB = Math.max(b.length(), 1e-9);
    const uA = a.divideScalar(dA), uB = b.divideScalar(dB);
    const q = new THREE.Quaternion().setFromUnitVectors(uA, uB);
    const dir = uA.clone().applyQuaternion(new THREE.Quaternion().slerp(q, e));
    const dist = dA * Math.pow(dB / dA, e);
    this.camera.position.copy(tgt).addScaledVector(dir, dist);
    // 고개는 비행 앞부분에서 먼저 돌린다
    const h = Math.min(1, t / 0.45), hs = h * h * (3 - 2 * h);
    o.look = o.fromTarget.clone().lerp(tgt, hs);
    this.camera.lookAt(o.look);
  }

  /* 날아가는 중에 화면을 만지면 그 자리에서 멈추고 바로 조작할 수 있게 */
  interruptFlight() {
    const o = this.orbit;
    if (!o || o.exiting || this.morph < 0.5) return;
    this.controls.target.copy(o.look || o.target);
    this.orbit = null;
    this.controls.minDistance = Math.min(this.minDistFor, this.camera.position.distanceTo(this.controls.target) * 0.9);
    this.controls.enabled = true;
  }

  /* ---------- 자유 확대 ----------
   * 가리키는 점을 중심으로 카메라와 회전 중심을 함께 줄이거나 늘린다(그 점은 손가락 밑에 그대로 남는다).
   * 근처에 태양·지구·행성·밝은 별이 있으면 그 천체를 중심으로 삼고, 다가갈수록 회전 중심도 그쪽으로 옮긴다.
   * 그래서 별자리 사이에서 태양 표시 쪽으로 계속 확대하면 버튼 없이 태양계, 행성 앞까지 갈 수 있다. */
  zoomAnchor(x, y) {
    const near = (p, r) => { const s = this.toScreen(p); return s && Math.hypot(s[0] - x, s[1] - y) < r ? Math.hypot(s[0] - x, s[1] - y) : null; };
    const R = this.overlay.clientWidth < 600 ? 56 : 40;
    let best = null;
    const consider = (id, point, radius, d) => { if (d != null && (!best || d < best.d)) best = { id, point, radius, d }; };
    if (this.solar.visible) {
      for (const p of this.planets || []) {
        const w = this.bodyWorld(p.id), r = this.bodyRadius(p.id);
        consider(p.id, w, r, near(w, R + this.pxRadius(w, r)));
      }
    }
    const sun = new THREE.Vector3(), rs = this.bodyRadius("sun");
    const ds = near(sun, R + this.pxRadius(sun, rs));
    if (ds != null) consider("sun", sun, rs, ds * 0.8); // 태양(우리 동네)을 조금 더 잘 잡는다
    if (!best && !this.solar.visible) {
      const i = this.nearestStar(x, y, R * 0.6);
      if (i != null) best = { id: `star:${i}`, point: this.starPos(i, new THREE.Vector3(), 1), radius: 0 };
    }
    if (best) return best;
    // 빈 곳: 화면의 그 점을 지나는 시선이 회전 중심 깊이와 만나는 곳
    const cam = this.camera, W = this.overlay.clientWidth, H = this.overlay.clientHeight;
    const dir = new THREE.Vector3((x / W) * 2 - 1, 1 - (y / H) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const depth = Math.max(1e-6, this.controls.target.clone().sub(cam.position).dot(fwd)) / Math.max(0.05, dir.dot(fwd));
    return { id: null, point: cam.position.clone().addScaledVector(dir, depth), radius: 0 };
  }

  /* factor < 1 이면 다가가고 > 1 이면 멀어진다. 실제 이동은 frame()에서 부드럽게 나눠서 한다 */
  zoomAt(x, y, factor, gesture) {
    if (this.morph < 0.5 || !(factor > 0)) return;
    if (!this.controls.enabled) return;
    if (gesture && !gesture.anchor) gesture.anchor = this.zoomAnchor(x, y);
    const a = gesture?.anchor || this.zoomAnchor(x, y);
    const q = this.zoomQ;
    if (q && q.anchor === a) q.log += Math.log(factor);
    else this.zoomQ = { anchor: a, log: Math.log(factor) };
  }

  applyZoom(dt) {
    const q = this.zoomQ;
    if (!q || !this.controls.enabled) return;
    const k = this.reduceMotion ? 1 : 1 - Math.exp(-dt * 14);
    let step = q.log * k;
    q.log -= step;
    if (Math.abs(q.log) < 1e-4) this.zoomQ = null;
    const cam = this.camera.position, tgt = this.controls.target, a = q.anchor;
    const P = a.id && !a.id.startsWith("star:") ? this.bodyWorld(a.id) : a.point;
    const d = cam.distanceTo(P);
    // 가장 가까이: 천체면 그 크기에 맞춰, 아니면 아주 가까이까지
    const minD = a.radius ? this.minDistForBody(a.id, a.radius) : 2e-6, maxD = 1500 * LY; // 가장 멀리: 우리 둘레 별 동네가 한눈에 (더 멀면 별이 거의 안 보인다)
    let s = Math.exp(step);
    if (d * s < minD) { s = minD / d; this.zoomQ = null; }
    if (d * s > maxD) { s = maxD / d; this.zoomQ = null; }
    cam.sub(P).multiplyScalar(s).add(P);
    tgt.sub(P).multiplyScalar(s).add(P);
    // 초점 천체에서 충분히 멀어지면 초점을 놓는다
    if (this.focus?.radius && cam.distanceTo(tgt) > this.focus.radius * 400) this.focus = null;
    if (a.id && step < 0) {
      // 다가갈 때 회전 중심을 그 천체로 조금씩 옮긴다 (화면이 휙 돌지 않게 아주 조금씩)
      tgt.lerp(P, Math.min(1, -step * 0.9));
      if (tgt.distanceTo(P) < d * s * 0.03) {
        tgt.copy(P);
        if (!a.id.startsWith("star:")) this.focus = { id: a.id, radius: a.radius };
      }
    }
  }

  minDistForBody(id, radius) {
    const r = radius * (id === "saturn" ? 2.3 : 1);
    return Math.max(r * 1.3, this.fitDistance(r, 1) * 0.85);
  }

  /* 고른 별 주위로 날아가기 */
  orbitStar(i) {
    const p = this.starPos(i, new THREE.Vector3(), 1); // 이동이 끝난 뒤의 실제 위치
    const off = this.camera.position.clone().sub(this.controls.target).setLength(Math.max(40, p.length() * 0.15));
    this.selectedStar = i;
    this.flyTo(p.clone().add(off), p);
  }

  resetSpaceView() {
    if (this.selected) this.orbitTo(this.selected);
  }

  setAutoRotate(on) { this.controls.autoRotate = on; }

  /* 화면 아래쪽을 팝업이 가릴 때, 보는 대상이 남은 영역 가운데에 오도록 화면 중심을 위로 올린다 (픽셀) */
  setFocusShift(px) { this.focusShiftTarget = Math.max(0, px || 0); }

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
      target: ctr, t: this.reduceMotion ? 1 : 0, speed: 1 / 2.2,
    };
    this.focus = null;
    this.updateLineColors();
  }

  orbitTo(id) {
    this.selected = id;
    const ctr = this.centroid3D(id);
    // 지구(원점)에서 별자리를 바라보던 쪽에서 비스듬히 본다
    const side = new THREE.Vector3().crossVectors(ctr, new THREE.Vector3(0, 1, 0)).normalize();
    const off = side.multiplyScalar(1.15).add(new THREE.Vector3(0, 0.35, 0)).multiplyScalar(ctr.length());
    this.selectedPlanet = null;
    this.flyTo(ctr.clone().add(off), ctr);
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
      this.interruptFlight();
      pointers.set(e.pointerId, pos(e));
      const [x, y] = pos(e);
      drag = { x, y, sx: x, sy: y, moved: 0, pinch: pointers.size === 2 ? this.pinchDist(pointers) : null, fov0: this.fov };
      if (!this.controls.enabled) el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      const [x, y] = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [x, y]);
      // 입체 우주: 두 손가락을 벌리고 오므리면 두 손가락 가운데로 다가가고 멀어진다
      if (this.morph > 0.5 && pointers.size === 2 && drag) {
        const dist = this.pinchDist(pointers), [a, b] = [...pointers.values()];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (drag.pinch3 == null) { drag.pinch3 = dist; drag.anchor = null; }
        else if (dist > 0 && drag.pinch3 > 0) {
          this.zoomAt(mx, my, Math.pow(drag.pinch3 / dist, 2.2), drag);
          drag.pinch3 = dist;
        }
        drag.moved = 99; return;
      }
      if (drag && !this.controls.enabled && this.morph < 0.5) {
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
    let wheelGesture = null;
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.morph > 0.5) {
        this.interruptFlight();
        const [x, y] = pos(e), now = performance.now();
        // 이어지는 휠 동작은 같은 끌림 대상을 쓴다
        if (!wheelGesture || now - wheelGesture.t > 300 || Math.hypot(x - wheelGesture.x, y - wheelGesture.y) > 12) wheelGesture = { x, y, anchor: null };
        wheelGesture.t = now;
        const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
        this.zoomAt(x, y, Math.exp(Math.max(-0.6, Math.min(0.6, dy * 0.0035))), wheelGesture);
        return;
      }
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
      // 가까이서 크게 보이는 행성은 원반 안을 눌러도 된다
      const big = this.morph > 0.5 ? this.pxRadius(this.bodyWorld(p.id), this.bodyRadius(p.id)) : 0;
      const d = Math.hypot(s[0] - x, s[1] - y) - big;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /* 태양(sun) 또는 행성의 지금 세계 좌표 */
  bodyWorld(id, out = new THREE.Vector3()) {
    if (id === "sun") return out.set(0, 0, 0);
    const p = this.planets?.find((q) => q.id === id);
    return p ? out.set(...p.helio).applyMatrix4(this.solar.matrix) : out.set(0, 0, 0);
  }
  bodyRadius(id) { return (BODY_R[id] || 0) * AU; }

  /* 지구 위 관측 장소의 세계 좌표 (지구 자전 각도까지 반영) */
  hereWorld(out = new THREE.Vector3()) {
    if (!this.place) return null;
    const th = (90 - this.place.lat) * D2R, ph = ((this.place.lon + 180) / 360) * Math.PI * 2;
    out.set(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
    this.solar.updateMatrixWorld(true);
    return this.planetMeshes.earth.children[0].localToWorld(out);
  }

  /* 행성 지도는 그 행성이 화면에서 커지거나 다가갈 때 처음 받는다 (모바일 데이터 절약) */
  ensureTextures(id) {
    if (this.texLoaded.has(id) || !TEX_FILES[id]) return;
    this.texLoaded.add(id);
    const loader = new THREE.TextureLoader(), maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    TEX_FILES[id].forEach((file, k) => {
      loader.load(TEX_URL(file), (t) => {
        t.colorSpace = file.includes("clouds") ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        t.anisotropy = Math.min(8, maxAniso);
        if (id === "earth") [this.bodyMats.earth.uDay, this.bodyMats.earth.uNight, this.bodyMats.earthClouds.uClouds][k].value = t;
        else if (id === "saturn" && k === 1) this.bodyMats.saturnRing.uRing.value = t;
        else this.bodyMats[id].uDay.value = t;
      }, undefined, () => this.texLoaded.delete(id));
    });
  }

  /* 반지름 r인 것이 화면에 꽉 차지 않고 들어오는 거리 (세로 화면이면 좌우 시야가 좁다) */
  fitDistance(r, fill = 0.8) {
    const v = 30 * D2R, hz = Math.atan(Math.tan(v) * this.camera.aspect);
    return r / Math.sin(Math.min(v, hz) * fill);
  }

  get eclipticAxes() {
    const rot = new THREE.Matrix4().extractRotation(this.solar.matrix);
    return { up: new THREE.Vector3(0, 0, 1).applyMatrix4(rot), x: new THREE.Vector3(1, 0, 0).applyMatrix4(rot) };
  }

  /* 행성 가까이로: 햇빛 받는 쪽에서 살짝 비스듬히, 행성이 화면에 알맞게 차도록 */
  orbitPlanet(id) {
    if (id === "sun") { this.focusSun(); return; }
    const pos = this.bodyWorld(id), r = this.bodyRadius(id);
    const { up } = this.eclipticAxes;
    const toSun = pos.clone().negate().normalize();
    const side = new THREE.Vector3().crossVectors(up, toSun).normalize();
    let dir = toSun.clone().multiplyScalar(0.8).add(side.clone().multiplyScalar(0.55)).add(up.clone().multiplyScalar(0.3)).normalize();
    if (id === "saturn") {
      // 토성: 고리가 잘 보이게 황도면보다 높은 곳에서 (2025~26년은 햇빛이 고리 면과 거의 나란해 옆에서 보면 선처럼 얇다)
      dir = toSun.clone().multiplyScalar(0.55).add(side.clone().multiplyScalar(0.35)).add(up.clone().multiplyScalar(0.95)).normalize();
    }
    if (id === "earth") {
      // 지구: 지금 내가 있는 곳 위에서 본다. 밤이면 도시 불빛이, 가장자리에 햇빛 든 쪽이 보인다
      const here = this.hereWorld();
      if (here) dir = here.sub(pos).normalize().multiplyScalar(0.85).add(toSun.clone().multiplyScalar(0.3)).add(up.clone().multiplyScalar(0.15)).normalize();
    }
    const dist = this.fitDistance(r * (id === "saturn" ? 2.4 : 1), 0.42);
    this.selectedPlanet = id; this.selectedStar = null;
    this.flyTo(pos.clone().addScaledVector(dir, dist), pos, null, { id, radius: r });
  }

  focusSun() {
    const { up, x } = this.eclipticAxes, r = this.bodyRadius("sun");
    this.selectedPlanet = null;
    this.flyTo(x.multiplyScalar(0.9).add(up.multiplyScalar(0.45)).normalize().multiplyScalar(this.fitDistance(r, 0.35)), new THREE.Vector3(), null, { id: "sun", radius: r });
  }

  /* 태양계 전체(해왕성 궤도까지)가 보이는 자리로 */
  goSolarSystem() {
    const { up, x } = this.eclipticAxes;
    const dist = this.fitDistance(31 * AU, 0.92);
    this.selectedPlanet = null;
    this.flyTo(up.multiplyScalar(0.75).add(x.multiplyScalar(0.66)).normalize().multiplyScalar(dist), new THREE.Vector3(), null, { id: "sun", radius: this.bodyRadius("sun") });
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

  /* 세계 반지름 r인 공이 화면에서 차지하는 반지름 (픽셀) */
  pxRadius(center, r) {
    const d = this.camera.position.distanceTo(center);
    if (d <= r) return 1e4;
    return (r / (d * Math.tan((this.camera.fov / 2) * D2R))) * (this.overlay.clientHeight / 2);
  }

  /* 누르면 정보가 나오는 별과 행성 위치에 희미한 원을 그린다 (화면에서 너무 붙은 것은 하나만) */
  drawTapRings(g, W, H) {
    const v = new THREE.Vector3(), seen = new Set(), cell = 14, in3D = this.morph > 0.5;
    const lim = in3D ? 6.6 : this.uniforms.uMagLimit.value;
    const camPos = this.camera.position;
    g.save();
    g.lineWidth = 1;
    g.strokeStyle = `rgba(247,222,154,${in3D ? 0.2 : 0.24})`;
    g.beginPath();
    for (const [, i] of SKY_NAMED) {
      let mag = SKY_STARS[i][2];
      if (!in3D) {
        if (this.starAA[i].alt < 1) continue;
      } else {
        // 입체 우주: 카메라에서 본 밝기 (가까이 가면 밝아지고 멀어지면 어두워진다)
        const p = this.starPos(i, v), dc = Math.max(camPos.distanceTo(p), 0.05), de = Math.max(p.length(), 0.05);
        mag += 5 * Math.log10(dc / de);
      }
      if (mag > lim) continue;
      const s = this.toScreen(this.starPos(i, v));
      if (!s || s[0] < 0 || s[1] < 0 || s[0] > W || s[1] > H) continue;
      const key = `${Math.round(s[0] / cell)},${Math.round(s[1] / cell)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = 5 + Math.max(0, 2.5 - mag) * 1.6;
      g.moveTo(s[0] + r, s[1]); g.arc(s[0], s[1], r, 0, Math.PI * 2);
    }
    g.stroke();
    // 행성: 하늘에 뜬 것(올려다보기), 태양계 안에서 작게 보이는 것(입체 우주)
    g.strokeStyle = "rgba(255,214,150,0.32)";
    g.beginPath();
    for (const p of this.planets || []) {
      if (!in3D && (p.alt === undefined || p.alt < 0 || p.mag > lim + 0.5)) continue;
      if (in3D && (!this.solar.visible || p.id === "earth")) continue;
      const s = this.planetScreen(p, v);
      if (!s) continue;
      const pr = in3D ? this.pxRadius(this.bodyWorld(p.id), this.bodyRadius(p.id)) : 0;
      if (pr > 10) continue; // 크게 보이면 둘레는 필요 없다
      const r = Math.max(7, pr + 5);
      g.moveTo(s[0] + r, s[1]); g.arc(s[0], s[1], r, 0, Math.PI * 2);
    }
    g.stroke();
    g.restore();
  }

  /* 화면 밖에 있어도 그쪽 가장자리 위치를 돌려준다: [x, y, onScreen] */
  edgePoint(v, m) {
    const W = this.overlay.clientWidth, H = this.overlay.clientHeight;
    const p = v.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const behind = p.z >= 0;
    const q = p.clone().applyMatrix4(this.camera.projectionMatrix);
    let x = (q.x + 1) / 2 * W, y = (1 - q.y) / 2 * H;
    if (!behind && x >= m.l && x <= W - m.r && y >= m.t && y <= H - m.b) return [x, y, true];
    // 화면 가운데에서 그 방향으로 뻗은 선이 여백 상자와 만나는 곳
    let dx = p.x, dy = -p.y;
    if (behind && Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) dy = 1;
    const cx = (m.l + W - m.r) / 2, cy = (m.t + H - m.b) / 2;
    const hw = (W - m.r - m.l) / 2, hh = (H - m.b - m.t) / 2;
    const s = Math.min(hw / Math.max(Math.abs(dx), 1e-9), hh / Math.max(Math.abs(dy), 1e-9));
    x = cx + dx * s; y = cy + dy * s;
    return [x, y, false, Math.atan2(dy, dx)];
  }

  /* 입체 우주: 태양과 지구가 어디 있는지 늘 보여 준다. 화면 밖이면 가장자리에 화살표 */
  drawHomeMarkers(g, W, H, fs, fits) {
    this.markerHits = [];
    if (this.morph < 0.5) return;
    const narrow = W < 600;
    const m = this.opts.safeArea?.() || { l: 22, r: 22, t: narrow ? 128 : 96, b: narrow ? 92 : 70 };
    this.safe = m;
    const fmt = (units) => {
      const ly = units / LY;
      if (ly >= 0.5) return `${Math.round(ly).toLocaleString("ko-KR")}광년`;
      const au = units / AU;
      if (au >= 0.1) return `${au.toFixed(au < 10 ? 1 : 0)}AU`;
      return `${Math.max(1, Math.round(au * 14960)).toLocaleString("ko-KR")}만 km`; // 1AU = 1억 4,960만 km
    };
    const SUN = "255,226,160", EARTH = "140,190,255";
    let items;
    if (!this.solar.visible) {
      items = [{ pos: new THREE.Vector3(), label: "태양 · 지구 (우리)", color: SUN, r: 0, go: () => this.goSolarSystem(), dist: true }];
    } else {
      items = [
        { pos: this.bodyWorld("earth"), label: "지구 (우리)", color: EARTH, r: this.bodyRadius("earth"), go: () => { this.opts.onPlanet?.(this.planets.find((p) => p.id === "earth")); this.orbitPlanet("earth"); } },
        { pos: new THREE.Vector3(), label: "태양", color: SUN, r: this.bodyRadius("sun"), go: () => this.focusSun() },
      ];
    }
    for (const it of items) [it.x, it.y, it.on, it.ang] = this.edgePoint(it.pos, m);
    // 멀리서 태양계 전체를 보면 태양과 지구가 겹친다: 이름 하나로
    if (items.length === 2 && items[0].on && items[1].on && Math.hypot(items[0].x - items[1].x, items[0].y - items[1].y) < 40) {
      items[0].label = "지구 (우리) · 태양"; items[1].hidden = true;
      this.markerHits.push({ x: items[1].x, y: items[1].y, r: 14, go: items[1].go });
    }
    // 화면 밖에서 둘이 같은 쪽에 있으면 화살표 하나로 합친다
    const off = items.filter((it) => !it.on);
    if (off.length === 2 && Math.hypot(off[0].x - off[1].x, off[0].y - off[1].y) < 80) {
      off[1].hidden = true; off[0].label = "지구 · 태양"; off[0].color = SUN;
    }
    g.save();
    g.textBaseline = "middle";
    for (const it of items) {
      if (it.hidden) continue;
      const { x, y } = it;
      const dist = fmt(this.camera.position.distanceTo(it.pos));
      if (it.on) {
        const pr = it.r ? this.pxRadius(it.pos, it.r) : 0;
        if (pr > H * 0.6) continue; // 화면을 채울 만큼 가까우면 표시는 생략
        const ring = Math.max(9, pr + 5);
        if (pr < 14 && it.label !== "태양") {
          g.strokeStyle = `rgba(${it.color},0.9)`; g.lineWidth = 1.5;
          g.beginPath(); g.arc(x, y, ring, 0, Math.PI * 2); g.stroke();
        }
        g.font = `600 ${fs * 0.92}px "IBM Plex Sans KR", sans-serif`;
        const w = g.measureText(it.label).width;
        // 원반이 크면 위쪽 가운데, 작으면 오른쪽에 이름
        const big = pr > 30;
        const lx = big ? x : x + ring + 6 + w / 2, ly = big ? y - pr - 14 : y - (it.dist ? 7 : 0);
        const room = fits(lx, ly + (it.dist ? 8 : 0), w, fs * (it.dist ? 2.2 : 1.2)) || it.label !== "태양"; // 지구는 늘 이름을 단다
        fits(x, y, ring * 2, ring * 2, true); // 표시 둘레는 다른 이름이 덮지 않게
        if (room && ly > m.t - 10) {
          g.textAlign = "center"; g.fillStyle = `rgba(${it.color},1)`;
          g.fillText(it.label, lx, ly);
          if (it.dist) {
            g.font = `400 ${fs * 0.78}px "IBM Plex Sans KR", sans-serif`;
            g.fillStyle = "rgba(200,206,222,0.85)"; g.fillText(dist, lx, ly + 16);
          }
        }
        this.markerHits.push({ x, y, r: Math.max(22, ring + 6), go: it.go });
      } else {
        // 가장자리 화살표 + 이름 + 거리
        g.save(); g.translate(x, y); g.rotate(it.ang);
        g.fillStyle = `rgba(${it.color},0.95)`;
        g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -7); g.lineTo(-3, 0); g.lineTo(-6, 7); g.closePath(); g.fill();
        g.restore();
        const ca = Math.cos(it.ang), sa = Math.sin(it.ang);
        const lx = x - ca * 16, ly = y - sa * 16;
        g.font = `600 ${fs * 0.82}px "IBM Plex Sans KR", sans-serif`;
        const w1 = g.measureText(it.label).width;
        g.font = `400 ${fs * 0.74}px "IBM Plex Sans KR", sans-serif`;
        const w = Math.max(w1, g.measureText(dist).width);
        const align = ca > 0.3 ? "right" : ca < -0.3 ? "left" : "center";
        const ty = sa > 0.3 ? ly - 24 : sa < -0.3 ? ly + 6 : ly - 8;
        const bx = align === "right" ? lx - w - 6 : align === "left" ? lx - 6 : lx - w / 2 - 6;
        g.fillStyle = "rgba(6,9,20,0.72)"; g.fillRect(bx, ty - 10, w + 12, 32);
        g.textAlign = align;
        g.font = `600 ${fs * 0.82}px "IBM Plex Sans KR", sans-serif`;
        g.fillStyle = `rgba(${it.color},1)`; g.fillText(it.label, lx, ty);
        g.font = `400 ${fs * 0.74}px "IBM Plex Sans KR", sans-serif`;
        g.fillStyle = "rgba(200,206,222,0.9)"; g.fillText(dist, lx, ty + 14);
        fits(bx + (w + 12) / 2, ty + 6, w + 12, 32);
        this.markerHits.push({ x, y, r: 30, go: it.go });
        this.markerHits.push({ x: bx + (w + 12) / 2, y: ty + 6, r: Math.max(26, w / 2 + 6), go: it.go });
      }
    }
    g.restore();
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
    // 태양·지구 표시(화면 가장자리 화살표 포함)
    const mk = (this.markerHits || []).find((m) => Math.hypot(m.x - x, m.y - y) < m.r);
    if (mk) { mk.go(); return; }
    const planet = this.nearestPlanet(x, y);
    if (planet) {
      this.selectedPlanet = planet.id; this.selectedStar = null; this.opts.onPlanet?.(planet);
      if (this.morph > 0.5) this.orbitPlanet(planet.id);
      return;
    }
    if (this.morph > 0.5 && this.solar.visible) {
      const s = this.toScreen(new THREE.Vector3());
      if (s && Math.hypot(s[0] - x, s[1] - y) < Math.max(18, this.pxRadius(new THREE.Vector3(), this.bodyRadius("sun")) + 8)) { this.focusSun(); return; }
    }
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
    const camR = this.camera.position.length();
    this.solar.visible = this.morph > 0.5 && camR < 40;
    if (this.solar.visible) {
      const f = Math.min(1, Math.max(0, (40 - camR) / 25)); // 멀어지면 흐려진다
      const wp = new THREE.Vector3();
      this.orbitLines.forEach((l) => {
        // 그 행성에 바짝 다가가면 궤도선이 화면을 가로지르지 않게 흐리게
        const px = this.pxRadius(this.bodyWorld(l.userData.id, wp), this.bodyRadius(l.userData.id));
        l.material.opacity = 0.35 * f * Math.max(0.15, Math.min(1, 1.6 - px / 60));
      });
      for (const p of PLANETS) {
        // 원반이 몇 픽셀보다 커지면 빛점은 사라지고 공만 남는다
        const px = this.pxRadius(this.bodyWorld(p.id, wp), this.bodyRadius(p.id));
        this.planetSprites[p.id].material.opacity = f * Math.max(0, Math.min(1, (7 - px) / 5));
        const body = this.planetMeshes[p.id];
        if (!this.reduceMotion && SPIN[p.id]) body.rotation.y += dt * SPIN[p.id];
        if (body.userData.clouds && !this.reduceMotion) body.userData.clouds.rotation.y += dt * 0.004; // 구름은 천천히 흘러간다
        if (px > 3 || this.focus?.id === p.id) this.ensureTextures(p.id);
      }
      this.ensureTextures("sun"); this.ensureTextures("earth");
      if (this.pxRadius(this.moonBody.position.clone().applyMatrix4(this.solar.matrix), MOON_R * AU) > 3) this.ensureTextures("moon");
      if (this.saturnRing) {
        const ru = this.bodyMats.saturnRing;
        this.bodyWorld("saturn", ru.uCenter.value); ru.uR.value = this.bodyRadius("saturn");
        ru.uNormal.value.set(0, 0, 1).applyQuaternion(this.saturnRing.getWorldQuaternion(new THREE.Quaternion()));
      }
      const sunPx = this.pxRadius(wp.set(0, 0, 0), this.bodyRadius("sun"));
      this.sunGlow.material.opacity = Math.min(1, 0.55 + sunPx / 40);
    }
    this.home.scale.setScalar(this.morph > 0.5 && camR < 40 ? 0.035 : 0.05);
    this.home.material.opacity = this.solar.visible ? this.morph * Math.max(0, Math.min(1, (camR - 2) / 10)) : this.morph;
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
      cam.fov = 60; cam.up.set(0, 1, 0);
      if (o.exiting) {
        const e = o.t < 0.5 ? 4 * o.t ** 3 : 1 - (-2 * o.t + 2) ** 3 / 2;
        cam.position.lerpVectors(o.from, o.to, e);
        cam.lookAt(o.fromTarget.clone().lerp(dirFromAltAz(this.pitch, this.yaw).multiplyScalar(R), e));
      } else this.stepFlight(o, o.t);
      if (o.t >= 1) {
        if (o.exiting) { this.orbit = null; cam.position.set(0, 0, 0); }
        else {
          this.controls.target.copy(o.target);
          this.controls.minDistance = this.minDistFor;
          this.controls.enabled = true; this.orbit = null;
          this.controls.update();
        }
      }
    } else if (this.controls.enabled) {
      cam.fov = 60;
      this.applyZoom(dt);
      this.controls.update();
    } else {
      cam.position.set(0, 0, 0);
      cam.fov = this.fov;
      cam.up.set(0, 1, 0);
      cam.lookAt(dirFromAltAz(Math.min(89.9, this.pitch), this.yaw));
    }
    // 아주 가까이 다가가도 잘리지 않게 가까운 평면을 거리에 맞춘다
    // 행성 가까이에서는 그 행성 표면까지 거리를 기준으로 삼는다
    let near = 0.01;
    if (this.controls.enabled || this.orbit) {
      const tgt = this.orbit && !this.orbit.exiting ? this.orbit.target : this.controls.target;
      let gap = cam.position.distanceTo(tgt) * 0.02;
      if (this.solar.visible) {
        const wp = new THREE.Vector3();
        for (const id of ["sun", ...PLANETS.map((p) => p.id)]) {
          const d = cam.position.distanceTo(this.bodyWorld(id, wp)) - this.bodyRadius(id) * (id === "saturn" ? 2.4 : 1);
          gap = Math.min(gap, Math.max(d * 0.5, this.bodyRadius(id) * 0.02));
        }
      }
      near = Math.max(1e-7, Math.min(0.1, gap));
    }
    cam.near = near;
    // 팝업이 열려 있으면 화면 중심을 부드럽게 올린다
    const fsT = this.morph > 0.5 ? this.focusShiftTarget || 0 : 0;
    this.focusShift = (this.focusShift || 0) + (fsT - (this.focusShift || 0)) * (this.reduceMotion ? 1 : Math.min(1, dt * 6));
    const W0 = this.overlay.clientWidth, H0 = this.overlay.clientHeight;
    if (this.focusShift > 0.5 && W0 && H0) cam.setViewOffset(W0, H0, 0, this.focusShift, W0, H0);
    else if (cam.view) cam.clearViewOffset();
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
    const fits = (x, y, w, h, force = false) => {
      const b = [x - w / 2 - 4, y - h / 2 - 2, x + w / 2 + 4, y + h / 2 + 2];
      if (!force && boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return false;
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

    // 누를 수 있는 별(이름 있는 별)과 행성에 희미한 둘레. 발견하기에서는 힌트가 되므로 그리지 않는다
    if (this.mode === "explore" && (in3D || this.uniforms.uVis.value > 0.3)) this.drawTapRings(g, W, H);

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
    // 행성 이름 (올려다보기: 하늘에 뜬 행성 / 입체 우주: 태양계 안). 태양과 지구 표시를 먼저 자리 잡는다
    this.drawHomeMarkers(g, W, H, fs, fits);
    g.textAlign = "left";
    g.font = `600 ${fs * 0.9}px "IBM Plex Sans KR", sans-serif`;
    for (const p of this.planets || []) {
      if (in3D && p.id === "earth") continue; // 지구는 위 표시에서 따로 그린다
      const s = this.planetScreen(p, v);
      if (!s) continue;
      const pr = in3D ? this.pxRadius(this.bodyWorld(p.id), this.bodyRadius(p.id) * (p.id === "saturn" ? 2.3 : 1)) : 0;
      if (pr > H * 0.6) continue; // 화면을 채울 만큼 가까우면 이름은 생략
      const text = p.ko, sel = p.id === this.selectedPlanet;
      const w = g.measureText(text).width;
      const big = pr > 30;
      const lx = big ? s[0] - w / 2 : s[0] + 10, ly = big ? s[1] - pr - 14 : s[1] - 8;
      if (in3D && ly < (this.safe?.t ?? 100) - 10) continue; // 위쪽 메뉴와 겹치면 생략
      if (!fits(lx + w / 2, ly, w, fs) && !sel) continue;
      g.fillStyle = sel ? "rgba(247,222,154,1)" : "rgba(255,214,150,0.9)";
      if (sel && pr < 14) { g.strokeStyle = "rgba(247,222,154,0.95)"; g.lineWidth = 1.5; g.beginPath(); g.arc(s[0], s[1], Math.max(11, pr + 5), 0, Math.PI * 2); g.stroke(); }
      g.fillText(text, lx, ly);
    }

    if (in3D && this.solar.visible) {
      g.textAlign = "left";
      g.font = `600 ${fs * 0.9}px "IBM Plex Sans KR", sans-serif`;
      const ew = this.bodyWorld("earth"), epx = this.pxRadius(ew, this.bodyRadius("earth"));
      // 달: 지구 가까이 왔을 때만 이름
      const mw = this.moonBody.position.clone().applyMatrix4(this.solar.matrix);
      const ms = epx > 4 && this.toScreen(mw);
      if (ms) {
        const mpx = this.pxRadius(mw, MOON_R * AU), w = g.measureText("달").width;
        const lx = ms[0] + Math.max(8, mpx + 4), ly = ms[1] - Math.max(6, mpx * 0.7);
        if (fits(lx + w / 2, ly, w, fs)) { g.fillStyle = "rgba(230,230,225,0.9)"; g.fillText("달", lx, ly); }
      }
      // 관측 장소 핀: 지구가 크게 보이고 그 자리가 이쪽을 향할 때
      const here = epx > 22 && this.hereWorld();
      if (here) {
        const n = here.clone().sub(ew).normalize(), toCam = this.camera.position.clone().sub(here).normalize();
        const hs = n.dot(toCam) > 0.1 && this.toScreen(here);
        if (hs) {
          g.fillStyle = "rgba(255,90,90,1)"; g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 1.5;
          g.beginPath(); g.arc(hs[0], hs[1], 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
          const label = `${this.place.ko} (지금 여기)`;
          g.font = `600 ${fs * 0.85}px "IBM Plex Sans KR", sans-serif`;
          const w = g.measureText(label).width;
          g.fillStyle = "rgba(6,9,20,0.7)"; g.fillRect(hs[0] + 9, hs[1] - 20, w + 10, 20);
          g.fillStyle = "rgba(255,255,255,1)"; g.fillText(label, hs[0] + 14, hs[1] - 10);
          fits(hs[0] + 14 + w / 2, hs[1] - 10, w, fs, true);
        }
      }
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
