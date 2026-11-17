const $ = (s) => document.querySelector(s);
const STORE_KEY = "byeoljaripan.discovered";
const TOTAL = CONSTELLATIONS.length;

/* ---------- 상태 ---------- */
const tzLocal = -new Date().getTimezoneOffset() / 60;
const places = PLACES.map((p) => ({ ...p, tz: 9 }));
let place = places[0];
let evening;            // 관측일 (저녁 기준) {y, m, d}
let minutes;            // 저녁 6시부터 흐른 분
let viewKind = "look";  // look | dome | space
const discovered = (() => { try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || "[]")); } catch { return new Set(); } })();
const shared = { mode: "explore", showLines: true, showNames: true, selected: null, hint: null, skyCondition: "dark" };
const saveFound = () => localStorage.setItem(STORE_KEY, JSON.stringify([...discovered]));

const callbacks = {
  onSelect: (c) => { shared.selected = c ? c.id : null; syncViews(); showDetail(c); renderVisible(); },
  onDiscover: (c) => { saveFound(); toast(`새 별자리를 찾았습니다: ${c.ko}`); renderDiscover(); },
  onMiss: () => toast("별자리 선이 지나는 별이 아닙니다. 밝은 별 근처를 눌러 보세요."),
  onHover: (h) => {
    const tip = $("#stage-tip");
    if (!h) { tip.hidden = true; return; }
    const host = viewKind === "dome" ? $("#dome") : $("#stage-3d");
    tip.textContent = h.text;
    tip.style.left = `${host.offsetLeft + h.x}px`; tip.style.top = `${host.offsetTop + h.y}px`;
    tip.hidden = false;
  },
};

const dome = new SkyView($("#dome"), callbacks);
let sky = null;
try {
  const { Sky3D } = await import("./sky3d.js");
  sky = new Sky3D($("#stage-3d"), callbacks);
  window.sky3d = sky; // 콘솔에서 살펴보기용
} catch (err) {
  console.warn("3D를 시작하지 못했습니다", err);
}
window.skyView = dome;
const views = () => [dome, sky].filter(Boolean);
const active = () => (viewKind === "dome" || !sky ? dome : sky);

function syncViews() {
  for (const v of views()) Object.assign(v, shared, { discovered });
  for (const v of views()) v.draw();
}

/* ---------- 시간 ---------- */
/* 받침에 맞춰 은/는 */
const topic = (w) => { const c = w.charCodeAt(w.length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? "은" : "는"); };
const obsTime = () => Date.UTC(evening.y, evening.m - 1, evening.d, 18 - place.tz, 0) + minutes * 60000;

function setNow({ quiet } = {}) {
  const nowLocal = new Date(Date.now() + place.tz * 3600000);
  const h = nowLocal.getUTCHours(), mi = nowLocal.getUTCMinutes();
  const base = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()));
  if (h < 6) base.setUTCDate(base.getUTCDate() - 1);
  evening = { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
  let daytime = false;
  if (h >= 6 && h < 18) { minutes = 180; daytime = true; }
  else minutes = Math.round((((h - 18 + 24) % 24) * 60 + mi) / 10) * 10;
  $("#obs-date").value = `${evening.y}-${String(evening.m).padStart(2, "0")}-${String(evening.d).padStart(2, "0")}`;
  $("#obs-time").value = minutes;
  update();
  if (daytime && !quiet) toast("지금은 낮이라 별이 보이지 않습니다. 오늘 밤 9시 하늘을 보여 드립니다.");
  return daytime;
}

function timeLabel(min) {
  const total = (18 * 60 + min) % (24 * 60);
  const h = Math.floor(total / 60), m = total % 60;
  const ampm = h < 6 ? "새벽" : h < 12 ? "오전" : h < 18 ? "오후" : "밤";
  return `${ampm} ${h % 12 === 0 ? 12 : h % 12}시${m ? ` ${m}분` : ""}`;
}

/* ---------- 갱신 ---------- */
function update() {
  const time = obsTime();
  dome.set({ place, time });
  sky?.set({ place, time });
  syncViews();
  $("#obs-time-out").textContent = timeLabel(minutes);
  const sunAlt = dome.sun.alt, m = dome.moon;
  const moonText = m.alt > 0
    ? `달은 ${directionName(m.az)} ${altitudeWords(m.alt)}에 떠 있습니다 (${moonPhaseName(m)}, 밝기 ${Math.round(m.illum * 100)}%).`
    : `달은 지평선 아래에 있습니다 (${moonPhaseName(m)}).`;
  $("#summary").textContent = `${evening.m}월 ${evening.d}일 ${timeLabel(minutes)}, ${place.ko}. ${skyStateWords(sunAlt)} ${moonText}`;
  renderVisible();
  renderDiscover();
  if (shared.selected) showDetail(CONST_BY_ID[shared.selected], true);
}

function renderVisible() {
  const list = $("#visible-list");
  const vis = dome.visibleConstellations(15);
  $("#visible-heading").textContent = `${place.id === "here" ? "내 위치에서" : `${place.ko}에서`} 보이는 별자리 ${vis.length}개 (높이 뜬 순서)`;
  list.replaceChildren();
  for (const c of vis) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (c.id === shared.selected ? " is-on" : "");
    b.textContent = c.ko;
    b.title = `${directionName(c.center.az)} ${altitudeWords(c.center.alt)}, 고도 ${Math.round(c.center.alt)}°`;
    b.addEventListener("click", () => focusConstellation(c.id));
    list.appendChild(b);
  }
  if (!vis.length) list.textContent = "이 시각에는 지평선 위로 높이 뜬 별자리가 없습니다.";
}

function focusConstellation(id) {
  shared.selected = id;
  syncViews();
  if (sky && viewKind !== "dome") sky.lookAtConstellation(id);
  showDetail(CONST_BY_ID[id]);
  renderVisible();
}

function renderDiscover() {
  const visible = dome.visibleConstellations(10);
  const foundVisible = visible.filter((c) => discovered.has(c.id)).length;
  $("#progress-fill").style.width = `${(discovered.size / TOTAL) * 100}%`;
  $("#progress-text").textContent = `도감 ${discovered.size} / ${TOTAL}. 지금 하늘에 뜬 별자리 ${visible.length}개 가운데 ${foundVisible}개를 찾았습니다.`;
  const list = $("#found-list");
  list.replaceChildren();
  for (const c of CONSTELLATIONS.filter((k) => discovered.has(k.id))) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = c.ko;
    b.addEventListener("click", () => focusConstellation(c.id));
    list.appendChild(b);
  }
  if (!discovered.size) list.textContent = "아직 찾은 별자리가 없습니다. 밝은 별부터 눌러 보세요.";
}

/* 이 별자리가 저녁 9시에 가장 높이 뜨는 달 */
function bestSeason(id) {
  const c = CONST_BY_ID[id];
  let best = { alt: -90, month: 1 };
  for (let doy = 0; doy < 365; doy += 4) {
    const dt = new Date(Date.UTC(evening.y, 0, 1 + doy));
    const lst = localSiderealDeg(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 21 - place.tz), place.lon);
    for (const [ra, dec] of c.centers) {
      const { alt } = toAltAz(ra, dec, place.lat, lst);
      if (alt > best.alt) best = { alt, month: dt.getUTCMonth() + 1 };
    }
  }
  return best;
}

function depthText(id) {
  const ly = [...new Set(CONST_BY_ID[id].segs.flat())].map((i) => SKY_STARS[i][4]).filter(Boolean);
  if (ly.length < 2) return "";
  const near = Math.min(...ly), far = Math.max(...ly);
  return `선으로 이은 별들은 ${near.toLocaleString("ko-KR")}광년에서 ${far.toLocaleString("ko-KR")}광년까지 떨어져 있습니다. 지구에서만 한 그림처럼 보입니다.`;
}

function showDetail(c, quiet) {
  const box = $("#detail");
  if (!c || !(shared.mode === "explore" || discovered.has(c.id))) { box.hidden = true; return; }
  const k = dome.consts.find((q) => q.id === c.id);
  box.hidden = false;
  const alt = k.center.alt;
  $("#detail-pos").textContent = alt > 0
    ? `${alt > 70 ? "머리 위" : `${directionName(k.center.az)} ${altitudeWords(alt)}`}, 고도 ${Math.round(alt)}°`
    : "이 시각에는 지평선 아래에 있습니다.";
  $("#detail-name").textContent = c.ko;
  $("#detail-latin").textContent = c.la;
  const sign = ZODIAC_LINK[c.id] && SIGNS.find((s) => s.id === ZODIAC_LINK[c.id]);
  $("#detail-guide").textContent = CONST_GUIDE[c.id] || (sign ? sign.myth : "선을 따라 별을 하나씩 이어 보세요. 흐린 별이 많아 도시보다 어두운 곳에서 잘 보입니다.");
  $("#detail-depth").textContent = depthText(c.id);
  const best = bestSeason(c.id);
  $("#detail-season").textContent = best.alt < 8
    ? "한국에서는 거의 떠오르지 않는 남쪽 하늘의 별자리입니다."
    : `저녁 9시 기준 ${best.month}월에 가장 높이 뜹니다 (고도 약 ${Math.round(best.alt)}°).`;
  $("#detail-3d").hidden = !sky;
  $("#detail-3d").textContent = viewKind === "space" ? "지구로 돌아가기" : "입체로 보기";
  const z = $("#detail-zodiac");
  if (sign) { z.hidden = false; z.href = `index.html?sign=${sign.id}#reading`; z.textContent = `${sign.ko} 운세 보기`; }
  else z.hidden = true;
  if (!quiet && matchMedia("(max-width: 1100px)").matches) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), 3600);
}

/* ---------- 보기 전환 ---------- */
const HELP = {
  look: "끌어서 고개를 돌리고, 휠이나 두 손가락으로 확대합니다. 별을 누르면 별자리를 알려 줍니다.",
  dome: "가운데가 머리 위, 둘레가 지평선입니다. 하늘을 올려다본 방향이라 동쪽이 왼쪽에 있습니다.",
  space: "별들을 실제 거리로 옮겼습니다. 끌어서 별자리 주위를 돌아보세요. 지구에서 본 그림이 흩어집니다.",
};
function setView(kind) {
  if (!sky && kind !== "dome") { toast("이 브라우저에서는 3D를 쓸 수 없어 전천 지도로 보여 드립니다."); kind = "dome"; }
  const prev = viewKind;
  viewKind = kind;
  document.querySelectorAll(".view-tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === kind));
  $("#stage-3d").hidden = kind === "dome";
  $("#stage-dome").hidden = kind !== "dome";
  $("#compass").hidden = kind !== "look";
  $("#stage-help").textContent = HELP[kind];
  $("#stage").dataset.view = kind;
  if (kind === "dome") { dome.resize(); dome.draw(); }
  if (sky) {
    sky.resize();
    if (kind === "space") { sky.enter3D(shared.selected); shared.selected = sky.selected; syncViews(); showDetail(CONST_BY_ID[shared.selected], true); }
    else if (prev === "space") sky.exit3D();
  }
  if (shared.selected) showDetail(CONST_BY_ID[shared.selected], true);
}
document.querySelectorAll(".view-tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));
$("#detail-3d").addEventListener("click", () => setView(viewKind === "space" ? "look" : "space"));

$("#compass").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || !sky) return;
  if (b.dataset.zenith) sky.turnTo(sky.yaw, 90); else sky.turnTo(Number(b.dataset.az), 25);
});
$("#zoom-in").addEventListener("click", () => active().setZoom(active().zoom * 1.4));
$("#zoom-out").addEventListener("click", () => active().setZoom(active().zoom / 1.4));

/* ---------- 입력 ---------- */
const sel = $("#obs-place");
places.forEach((p, i) => sel.add(new Option(p.ko, i)));
sel.addEventListener("change", () => { place = places[sel.value]; update(); });

function useMyLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { toast("이 브라우저는 위치 확인을 지원하지 않습니다."); resolve(false); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const mine = { id: "here", ko: "내 위치", lat: pos.coords.latitude, lon: pos.coords.longitude, tz: tzLocal };
      const idx = places.findIndex((p) => p.id === "here");
      if (idx >= 0) places[idx] = mine; else { places.push(mine); sel.add(new Option("내 위치", places.length - 1)); }
      sel.value = places.indexOf(mine);
      place = mine;
      resolve(true);
    }, () => { toast("위치를 가져오지 못했습니다. 브라우저의 위치 권한을 허용하거나 장소를 직접 고르세요."); resolve(false); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
}

$("#here-now").addEventListener("click", async () => {
  const ok = await useMyLocation();
  const daytime = setNow({ quiet: true });
  setView("look");
  const top = dome.visibleConstellations(15);
  const where = ok ? "내 위치" : place.ko;
  if (daytime) toast(`지금 ${topic(where)} 낮입니다. 오늘 밤 9시에 보일 별자리 ${top.length}개를 보여 드립니다.`);
  else toast(`지금 ${where}에서 별자리 ${top.length}개가 떠 있습니다. 가장 높은 것은 ${top[0]?.ko ?? "없음"}입니다.`);
  if (top[0] && sky) sky.turnTo(top[0].center.az, Math.min(70, top[0].center.alt));
});

$("#obs-date").addEventListener("change", (e) => {
  if (!e.target.value) return;
  const [y, m, d] = e.target.value.split("-").map(Number);
  evening = { y, m, d }; update();
});
$("#obs-time").addEventListener("input", (e) => { minutes = Number(e.target.value); update(); });
$("#obs-now").addEventListener("click", () => setNow());
$("#obs-cond").addEventListener("change", (e) => { shared.skyCondition = e.target.value; syncViews(); });
$("#opt-lines").addEventListener("change", (e) => { shared.showLines = e.target.checked; syncViews(); });
$("#opt-names").addEventListener("change", (e) => { shared.showNames = e.target.checked; syncViews(); });

function setMode(mode) {
  shared.mode = mode;
  shared.hint = null;
  if (mode === "discover" && shared.selected && !discovered.has(shared.selected)) shared.selected = null;
  $("#tab-explore").setAttribute("aria-selected", mode === "explore");
  $("#tab-discover").setAttribute("aria-selected", mode === "discover");
  $("#panel-explore").hidden = mode !== "explore";
  $("#panel-discover").hidden = mode !== "discover";
  $("#hint-text").textContent = "";
  syncViews();
  showDetail(shared.selected ? CONST_BY_ID[shared.selected] : null, true);
}
$("#tab-explore").addEventListener("click", () => setMode("explore"));
$("#tab-discover").addEventListener("click", () => setMode("discover"));
document.querySelector(".mode-tabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = shared.mode === "explore" ? "discover" : "explore";
  setMode(next); $(`#tab-${next}`).focus();
});

$("#hint-btn").addEventListener("click", () => {
  // 아직 못 찾은 별자리 중 눈에 잘 띄고 높이 뜬 것부터
  const cand = dome.visibleConstellations(20).filter((c) => !discovered.has(c.id)).sort((a, b) => a.rank - b.rank || b.center.alt - a.center.alt);
  if (!cand.length) { $("#hint-text").textContent = "지금 하늘에 뜬 별자리는 모두 찾았습니다. 시각이나 날짜를 바꿔 보세요."; return; }
  const c = cand[0];
  shared.hint = c.id; syncViews();
  if (sky && viewKind === "look") sky.turnTo(c.center.az + (Math.random() - 0.5) * 30, Math.min(75, c.center.alt));
  const where = c.center.alt > 70 ? "머리 위" : `${directionName(c.center.az)} ${altitudeWords(c.center.alt)}`;
  $("#hint-text").textContent = `${where}, 점선 원 안을 살펴보세요. ${c.segs.flat().length > 12 ? "별이 많은 큰 별자리입니다." : "별 몇 개로 된 작은 별자리입니다."}`;
});
$("#reset-btn").addEventListener("click", () => {
  if (!confirm("찾은 별자리 기록을 모두 지울까요?")) return;
  discovered.clear(); saveFound(); shared.selected = null; showDetail(null); renderDiscover(); syncViews();
});

/* ---------- 시작 ---------- */
setNow({ quiet: true });
setView(sky ? "look" : "dome");
const q = new URLSearchParams(location.search).get("c");
if (q && CONST_BY_ID[q]) focusConstellation(q);
else {
  const top = dome.visibleConstellations(20)[0];
  if (top && sky) { sky.yaw = top.center.az; sky.pitch = Math.min(60, Math.max(20, top.center.alt - 10)); }
}
if (document.fonts) document.fonts.ready.then(() => dome.draw());
