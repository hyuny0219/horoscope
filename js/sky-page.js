const $ = (s) => document.querySelector(s);
/* 요소가 없으면 그 조작만 건너뛴다 (예전 HTML이 캐시에 남아 있어도 페이지 전체가 멈추지 않게) */
const on = (sel, ev, fn) => document.querySelector(sel)?.addEventListener(ev, fn);
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
const shared = { mode: "explore", showLines: true, showNames: true, showStarNames: true, selected: null, selectedStar: null, hint: null, skyCondition: "dark" };
const saveFound = () => localStorage.setItem(STORE_KEY, JSON.stringify([...discovered]));

/* 3D 화면 중 메뉴, 버튼, 설정판에 가리지 않는 영역 (태양·지구 화살표가 이 안에 머문다) */
function stageSafeArea() {
  const st = $("#stage").getBoundingClientRect();
  const m = { l: 18, r: 18, t: 90, b: 70 };
  const tabs = document.querySelector(".view-tabs").getBoundingClientRect();
  m.t = Math.max(m.t, tabs.bottom - st.top + 14);
  let low = st.bottom;
  for (const el of document.querySelectorAll("#space-pad, .zoom, #compass, #stage-help, #sky-pop")) {
    if (el.hidden || !el.offsetParent || !el.textContent.trim()) continue;
    low = Math.min(low, el.getBoundingClientRect().top);
  }
  m.b = Math.max(m.b, st.bottom - low + 12);
  const con = document.querySelector(".console");
  if (getComputedStyle(con).position === "absolute") m.r = Math.max(m.r, st.right - con.getBoundingClientRect().left + 16);
  return m;
}

const callbacks = {
  safeArea: stageSafeArea,
  onSelect: (c) => {
    shared.selected = c ? c.id : null; syncViews(); showDetail(c, true); renderVisible();
    if (c && (shared.mode === "explore" || discovered.has(c.id))) popConstellation(c.id); else hidePop();
  },
  onDiscover: (c) => { saveFound(); toast(`새 별자리를 찾았습니다: ${c.ko}`); renderDiscover(); },
  onStar: (i) => { showStar(i, true); popStar(i); },
  onPlanet: (p) => { showPlanet(p.id, true); popPlanet(p.id); },
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
  const { Sky3D } = await import("./sky3d.js?v=202611180117");
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
/* 받침에 맞춰 (으)로: 받침이 없거나 ㄹ이면 '로' */
const toward = (w) => { const c = w.charCodeAt(w.length - 1), j = (c - 0xac00) % 28; return w + (c >= 0xac00 && c <= 0xd7a3 && j && j !== 8 ? "으로" : "로"); };
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
  let state = skyStateWords(sunAlt);
  if (sunAlt < -12 && m.alt > 10 && m.illum > 0.6) state = "어두운 밤이지만 밝은 달빛 때문에 흐린 별과 은하수는 잘 보이지 않습니다.";
  const real = new Date(obsTime() + place.tz * 3600000); // 자정을 넘기면 실제 날짜로
  $("#summary").textContent = `${real.getUTCMonth() + 1}월 ${real.getUTCDate()}일 ${timeLabel(minutes)}, ${place.ko}. ${state} ${moonText}`;
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

function focusConstellation(id, quiet) {
  shared.selected = id;
  syncViews();
  if (sky && viewKind !== "dome") sky.lookAtConstellation(id);
  showDetail(CONST_BY_ID[id], quiet);
  if (quiet) popConstellation(id); else hidePop();
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
  if (sign) { z.hidden = false; z.href = `zodiac.html?sign=${sign.id}#reading`; z.textContent = `${sign.ko} 운세 보기`; }
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
  space: "끌어서 돌리고, 휠이나 두 손가락으로 가리키는 곳에 다가갑니다. 태양·지구 표시 쪽으로 계속 확대하면 태양계와 행성 앞까지 갈 수 있습니다. 행성이나 태양을 누르면 그 앞까지 날아갑니다.",
};
function setView(kind) {
  if (!sky && kind !== "dome") { toast("이 브라우저에서는 3D를 쓸 수 없어 전천 지도로 보여 드립니다."); kind = "dome"; }
  const prev = viewKind;
  viewKind = kind;
  if (prev !== kind) hidePop();
  else shiftForPop();
  document.querySelectorAll(".view-tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === kind));
  $("#stage-3d").hidden = kind === "dome";
  $("#stage-dome").hidden = kind !== "dome";
  $("#compass").hidden = kind !== "look";
  $("#space-pad").hidden = kind !== "space";
  if (kind !== "space" && sky) { sky.setAutoRotate(false); $("#space-auto").setAttribute("aria-pressed", "false"); }
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
on("#detail-3d", "click", () => setView(viewKind === "space" ? "look" : "space"));

on("#compass", "click", (e) => {
  const b = e.target.closest("button");
  if (!b || !sky) return;
  if (b.dataset.zenith) sky.turnTo(sky.yaw, 90); else sky.turnTo(Number(b.dataset.az), 25);
});
on("#space-pad", "click", (e) => {
  const b = e.target.closest("button[data-orbit]");
  if (b && sky) sky.orbitBy(...b.dataset.orbit.split(",").map(Number));
});
on("#space-auto", "click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", on);
  sky?.setAutoRotate(on);
});
on("#space-reset", "click", () => sky?.resetSpaceView());
on("#zoom-in", "click", () => active().setZoom(active().zoom * 1.4));
on("#zoom-out", "click", () => active().setZoom(active().zoom / 1.4));

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

on("#here-now", "click", async () => {
  const ok = await useMyLocation();
  const daytime = setNow({ quiet: true });
  setView("look");
  const top = dome.visibleConstellations(15);
  const where = ok ? "내 위치" : place.ko;
  if (daytime) toast(`지금 ${topic(where)} 낮입니다. 오늘 밤 9시에 보일 별자리 ${top.length}개를 보여 드립니다.`);
  else toast(`지금 ${where}에서 별자리 ${top.length}개가 떠 있습니다. 가장 높은 것은 ${top[0]?.ko ?? "없음"}입니다.`);
  if (top[0] && sky) sky.turnTo(top[0].center.az, Math.min(70, top[0].center.alt));
});

on("#obs-date", "change", (e) => {
  if (!e.target.value) return;
  const [y, m, d] = e.target.value.split("-").map(Number);
  evening = { y, m, d }; update();
});
on("#obs-time", "input", (e) => { minutes = Number(e.target.value); update(); });
on("#obs-now", "click", () => setNow());
on("#obs-cond", "change", (e) => { shared.skyCondition = e.target.value; syncViews(); });
on("#opt-lines", "change", (e) => { shared.showLines = e.target.checked; syncViews(); });
on("#opt-names", "change", (e) => { shared.showNames = e.target.checked; syncViews(); });
on("#obs-gain", "input", (e) => {
  const g = Number(e.target.value);
  sky?.setBrightness(g);
  $("#obs-gain-out").textContent = g < 0.9 ? "실제보다 어둡게" : g < 1.15 ? "실제와 비슷하게" : g < 1.7 ? "보통보다 밝게" : "아주 밝게";
});
on("#opt-starnames", "change", (e) => { shared.showStarNames = e.target.checked; syncViews(); });

/* ---------- 하늘 위 투명 팝업 ----------
 * 별이나 별자리, 행성을 누르면 화면을 아래로 내리지 않고 하늘 위에 요약을 띄운다.
 * 전체 설명은 "자세히"를 눌렀을 때만 아래 설명판으로 간다. */
function showPop({ star = false, kicker = "", title, sub = "", facts = [], body = "", actions = [] }) {
  const pop = $("#sky-pop");
  pop.classList.toggle("is-star", star);
  $("#sky-pop-kicker").textContent = kicker;
  $("#sky-pop-title").textContent = title;
  $("#sky-pop-sub").textContent = sub;
  $("#sky-pop-facts").replaceChildren(...facts.map(([k, v]) => {
    const li = document.createElement("li"), b = document.createElement("b");
    b.textContent = k; li.append(b, v); return li;
  }));
  $("#sky-pop-body").textContent = body;
  $("#sky-pop-actions").replaceChildren(...actions.map(({ label, onClick, primary }) => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = `btn ${primary ? "btn-ink" : "btn-line"}`;
    btn.textContent = label; btn.addEventListener("click", onClick);
    return btn;
  }));
  pop.hidden = false;
  $("#stage").classList.add("has-pop");
  shiftForPop();
}
function hidePop() {
  $("#sky-pop").hidden = true;
  $("#stage").classList.remove("has-pop");
  sky?.setFocusShift?.(0);
}
/* 입체 우주에서는 카메라가 대상을 화면 가운데에 두므로, 팝업에 가리지 않게 화면 중심을 올린다 */
function shiftForPop() {
  if (!sky) return;
  const pop = $("#sky-pop"), st = $("#stage").getBoundingClientRect();
  if (pop.hidden || viewKind !== "space") { sky.setFocusShift(0); return; }
  const r = pop.getBoundingClientRect();
  // 팝업이 화면 가로 대부분을 덮을 때(모바일)만: 위쪽 남은 영역의 가운데로
  const covers = r.width > st.width * 0.6;
  sky.setFocusShift(covers ? Math.max(0, (st.bottom - r.top) / 2 - 20) : 0);
}
addEventListener("resize", shiftForPop);
/* PC: 오른쪽 설정판에 가리지 않게 3D 화면의 중심을 남은 영역 가운데로 */
function shiftForConsole() {
  if (!sky?.setSideShift) return;
  const con = document.querySelector(".console"), st = $("#stage").getBoundingClientRect();
  sky.setSideShift(getComputedStyle(con).position === "absolute" ? (st.right - con.getBoundingClientRect().left) / 2 : 0);
}
addEventListener("resize", shiftForConsole);
shiftForConsole();
on("#sky-pop-close", "click", () => {
  hidePop();
  showStar(null);
  if (sky) { sky.selectedPlanet = null; }
});
const moreAction = (sel) => ({ label: "자세히", onClick: () => $(sel).scrollIntoView({ block: "start", behavior: "smooth" }) });
const whereText = (aa) => aa.alt > 0 ? `${aa.alt > 70 ? "머리 위" : `${directionName(aa.az)} ${altitudeWords(aa.alt)}`}, 고도 ${Math.round(aa.alt)}°` : "지금은 지평선 아래";

function popStar(i) {
  const s = starInfo(i), aa = starAltAz(i);
  const actions = [];
  if (s.con) actions.push({ label: `${s.con.ko} 보기`, primary: true, onClick: () => focusConstellation(s.conId, true) });
  actions.push(moreAction("#star-detail"));
  showPop({
    star: true,
    kicker: [s.con ? `${s.con.ko}의 별` : null, viewKind === "space" ? null : whereText(aa)].filter(Boolean).join(" · "),
    title: s.name,
    sub: [s.trad && `옛 이름 ${s.trad}`, s.en].filter(Boolean).join(", "),
    facts: [["밝기", `${s.mag.toFixed(1)}등급`], ["거리", s.ly ? `${s.ly.toLocaleString("ko-KR")}광년` : "모름"], ["색", s.colorWord]],
    body: s.story || (s.lightYear ? `지금 보이는 이 별빛은 ${s.lightYear}에 별을 떠났습니다.` : ""),
    actions,
  });
}

function popConstellation(id) {
  const c = CONST_BY_ID[id], k = dome.consts.find((q) => q.id === id);
  if (!c || !k) return;
  const sign = ZODIAC_LINK[id] && SIGNS.find((x) => x.id === ZODIAC_LINK[id]);
  const actions = [];
  if (sky) actions.push({ label: viewKind === "space" ? "지구로 돌아가기" : "입체로 보기", primary: true, onClick: () => setView(viewKind === "space" ? "look" : "space") });
  if (sign) actions.push({ label: `${sign.ko} 운세`, onClick: () => { location.href = `zodiac.html?sign=${sign.id}#reading`; } });
  actions.push(moreAction("#detail"));
  showPop({
    kicker: viewKind === "space" ? "별자리" : whereText(k.center),
    title: c.ko, sub: c.la,
    body: CONST_GUIDE[id] || (sign ? sign.myth : ""),
    actions,
  });
}

function popPlanet(id) {
  const p = (sky?.planets || planetPositions(obsTime())).find((q) => q.id === id);
  if (!p) return;
  const lm = p.delta ? (p.delta * 499.005) / 60 : null;
  const facts = [["태양에서", `${p.r.toFixed(2)}AU`]];
  if (p.delta) facts.push(["지구에서", `빛으로 ${lm < 60 ? `${Math.round(lm)}분` : `${(lm / 60).toFixed(1)}시간`}`], ["밝기", `${p.mag.toFixed(1)}등급`]);
  const actions = [];
  if (sky && viewKind !== "space") actions.push({ label: "태양계에서 보기", primary: true, onClick: () => { hidePop(); setView("space"); setTimeout(() => sky.orbitPlanet(id), 2500); } });
  actions.push(moreAction("#star-detail"));
  const aa = p.ra !== undefined ? toAltAz(p.ra, p.dec, place.lat, localSiderealDeg(obsTime(), place.lon)) : null;
  showPop({
    star: true,
    kicker: p.id === "earth" ? "우리가 사는 행성" : viewKind === "space" ? `${toward(p.ko)} 가는 중` : whereText(aa),
    title: p.ko, sub: `${p.kind}, 공전 ${p.period}`,
    facts, body: p.note, actions,
  });
}

/* ---------- 별 정보 ---------- */
function starAltAz(i) {
  const [ra, dec] = SKY_STARS[i];
  return toAltAz(ra, dec, place.lat, localSiderealDeg(obsTime(), place.lon));
}

/* 이 별이 저녁 9시에 가장 높이 뜨는 달 */
function starBestMonth(i) {
  const [ra, dec] = SKY_STARS[i];
  let best = { alt: -90, month: 1 };
  for (let doy = 0; doy < 365; doy += 4) {
    const dt = new Date(Date.UTC(evening.y, 0, 1 + doy));
    const { alt } = toAltAz(ra, dec, place.lat, localSiderealDeg(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 21 - place.tz), place.lon));
    if (alt > best.alt) best = { alt, month: dt.getUTCMonth() + 1 };
  }
  return best;
}

function showStar(i, quiet) {
  const box = $("#star-detail");
  if (i == null) { box.hidden = true; shared.selectedStar = null; if (sky) sky.selectedStar = null; return; }
  shared.selectedStar = i;
  if (sky) sky.selectedStar = i;
  const s = starInfo(i), aa = starAltAz(i);
  box.hidden = false;
  $("#star-pos").textContent = aa.alt > 0
    ? `${aa.alt > 70 ? "머리 위" : `${directionName(aa.az)} ${altitudeWords(aa.alt)}`}, 고도 ${Math.round(aa.alt)}°`
    : (() => { const b = starBestMonth(i); return b.alt < 5 ? "한국에서는 거의 볼 수 없는 남쪽 하늘의 별입니다." : `지금은 지평선 아래에 있습니다. 저녁 9시 기준 ${b.month}월에 가장 높이 뜹니다.`; })();
  $("#star-name").textContent = s.name;
  $("#star-sub").textContent = [s.en, s.bayer].filter(Boolean).join(", ");
  const facts = [
    ["밝기", `${s.mag.toFixed(1)}등급 (${s.magClass}), 밤하늘에서 ${s.rank}번째`],
    ["거리", s.ly ? `${s.ly.toLocaleString("ko-KR")}광년` : "알려지지 않음"],
    ["색과 온도", `${s.colorWord}, 약 ${s.temp.toLocaleString("ko-KR")}K`],
    ["별자리", s.con ? s.con.ko : "없음"],
  ];
  if (s.trad) facts.splice(1, 0, ["옛 이름", s.trad]);
  const dl = $("#star-facts");
  dl.replaceChildren(...facts.map(([k, v]) => { const d = document.createElement("div"); const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; d.append(dt, dd); return d; }));
  $("#star-story").textContent = s.story || "";
  $("#star-light").textContent = s.lightYear ? `지금 보이는 이 별빛은 ${s.lightYear}에 별을 떠났습니다.` : "";
  const cb = $("#star-const");
  cb.hidden = !s.con;
  if (s.con) { cb.textContent = `${s.con.ko} 보기`; cb.onclick = () => focusConstellation(s.conId); }
  if (!quiet && matchMedia("(max-width: 1100px)").matches) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
on("#star-close", "click", () => showStar(null));

/* ---------- 행성 정보 ---------- */
function showPlanet(id, quiet) {
  const p = (sky?.planets || planetPositions(obsTime())).find((q) => q.id === id);
  if (!p) return;
  if (sky) { sky.selectedPlanet = id; sky.selectedStar = null; }
  const box = $("#star-detail");
  box.hidden = false;
  const aa = p.ra !== undefined ? toAltAz(p.ra, p.dec, place.lat, localSiderealDeg(obsTime(), place.lon)) : null;
  $("#star-pos").textContent = p.id === "earth" ? "우리가 서 있는 곳" : aa.alt > 0
    ? `${aa.alt > 70 ? "머리 위" : `${directionName(aa.az)} ${altitudeWords(aa.alt)}`}, 고도 ${Math.round(aa.alt)}°`
    : "이 시각에는 지평선 아래에 있습니다.";
  $("#star-name").textContent = p.ko;
  $("#star-sub").textContent = `${p.kind}, 태양을 한 바퀴 도는 데 ${p.period}`;
  const lm = p.delta ? (p.delta * 499.005) / 60 : null; // 1AU를 빛이 가는 데 499초
  const facts = [["태양에서", `${p.r.toFixed(2)}AU (1AU = 태양과 지구 사이 거리)`]];
  if (p.delta) {
    facts.push(["지구에서", `${p.delta.toFixed(2)}AU, 빛으로 ${lm < 60 ? `${Math.round(lm)}분` : `${(lm / 60).toFixed(1)}시간`}`]);
    facts.push(["밝기", `${p.mag.toFixed(1)}등급${p.mag < 6 ? "" : " (맨눈으로는 안 보임)"}`]);
    const sign = SIGNS[Math.floor(eclipticLongitudeOf(p.ra, p.dec) / 30) % 12];
    facts.push(["황도 12궁으로는", `${sign.glyph} ${sign.ko}`]);
  }
  const dl = $("#star-facts");
  dl.replaceChildren(...facts.map(([k, v]) => { const d = document.createElement("div"); const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; d.append(dt, dd); return d; }));
  $("#star-story").textContent = p.note;
  $("#star-light").textContent = p.delta ? `지금 보이는 ${p.ko}의 빛은 햇빛이 ${p.ko}에 반사되어 약 ${lm < 60 ? `${Math.round(lm)}분` : `${(lm / 60).toFixed(1)}시간`} 걸려 온 것입니다.` : "";
  const cb = $("#star-const");
  cb.hidden = !sky;
  cb.textContent = viewKind === "space" ? `${p.ko} 가까이 가기` : "태양계에서 보기";
  cb.onclick = () => { if (viewKind !== "space") setView("space"); setTimeout(() => sky.orbitPlanet(id), viewKind === "space" ? 0 : 2500); };
  if (!quiet && matchMedia("(max-width: 1100px)").matches) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* 적경·적위 → 황경 (행성이 어느 황도 별자리 방향에 있는지) */
function eclipticLongitudeOf(ra, dec) {
  const e = 23.43928 * DEG, a = ra * DEG, d = dec * DEG;
  return norm360(Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a)) / DEG);
}

/* ---------- 찾기 ---------- */
const SEARCH = [
  ...CONSTELLATIONS.map((c) => ({ kind: "c", id: c.id, label: c.ko, keys: [c.ko, c.ko.replace(/자리$/, ""), c.la] })),
  ...SKY_NAMED.map(([en, i, ko]) => ({ kind: "s", id: i, label: starName(i), keys: [starName(i), ko, en, STAR_TRAD[en]].filter(Boolean) })),
  { kind: "c", id: "UMa", label: "북두칠성 (큰곰자리)", keys: ["북두칠성"] },
  ...PLANETS.map((p) => ({ kind: "p", id: p.id, label: p.ko, keys: [p.ko, p.id] })),
  { kind: "p", id: "venus", label: "샛별 (금성)", keys: ["샛별", "개밥바라기"] },
  { kind: "s", id: SKY_NAMED.find((n) => n[0] === "Polaris")?.[1], label: "북극성", keys: ["북극성", "폴라리스"] },
];
$("#search-list").replaceChildren(...[...new Set(SEARCH.map((x) => x.label))].map((l) => new Option(l)));
const norm = (t) => (t || "").toLowerCase().replace(/[\s()]/g, "");
on("#search", "submit", (e) => {
  e.preventDefault();
  const q = norm($("#search-input").value);
  if (!q) return;
  const hit = SEARCH.find((x) => x.keys.some((k) => norm(k) === q)) || SEARCH.find((x) => x.keys.some((k) => norm(k).includes(q)));
  if (!hit || hit.id == null) { toast(`"${$("#search-input").value}"을(를) 찾지 못했습니다. 다른 이름으로 찾아보세요.`); return; }
  if (viewKind === "space") setView("look");
  if (hit.kind === "c") { focusConstellation(hit.id); return; }
  if (hit.kind === "p") {
    showPlanet(hit.id);
    const p = sky?.planets.find((q) => q.id === hit.id);
    if (p && p.alt > 0) { sky.turnTo(p.az, Math.max(5, Math.min(85, p.alt))); toast(`${p.ko}: ${directionName(p.az)} ${altitudeWords(p.alt)}에 있습니다.`); }
    else if (hit.id !== "earth") toast(`${PLANETS.find((q) => q.id === hit.id).ko}은(는) 지금 지평선 아래에 있습니다. 태양계에서 보기를 눌러 보세요.`);
    return;
  }
  const aa = starAltAz(hit.id);
  showStar(hit.id);
  if (aa.alt > 0) { sky?.lookAtStar(hit.id); toast(`${starName(hit.id)}: ${directionName(aa.az)} ${altitudeWords(aa.alt)}에 있습니다.`); }
  else toast(`${starName(hit.id)}은(는) 지금 지평선 아래에 있습니다.`);
});

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
on("#tab-explore", "click", () => setMode("explore"));
on("#tab-discover", "click", () => setMode("discover"));
document.querySelector(".mode-tabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = shared.mode === "explore" ? "discover" : "explore";
  setMode(next); $(`#tab-${next}`).focus();
});

on("#hint-btn", "click", () => {
  // 아직 못 찾은 별자리 중 눈에 잘 띄고 높이 뜬 것부터
  const cand = dome.visibleConstellations(20).filter((c) => !discovered.has(c.id)).sort((a, b) => a.rank - b.rank || b.center.alt - a.center.alt);
  if (!cand.length) { $("#hint-text").textContent = "지금 하늘에 뜬 별자리는 모두 찾았습니다. 시각이나 날짜를 바꿔 보세요."; return; }
  const c = cand[0];
  shared.hint = c.id; syncViews();
  if (sky && viewKind === "look") sky.turnTo(c.center.az + (Math.random() - 0.5) * 30, Math.min(75, c.center.alt));
  const where = c.center.alt > 70 ? "머리 위" : `${directionName(c.center.az)} ${altitudeWords(c.center.alt)}`;
  $("#hint-text").textContent = `${where}, 점선 원 안을 살펴보세요. ${c.segs.flat().length > 12 ? "별이 많은 큰 별자리입니다." : "별 몇 개로 된 작은 별자리입니다."}`;
});
on("#reset-btn", "click", () => {
  if (!confirm("찾은 별자리 기록을 모두 지울까요?")) return;
  discovered.clear(); saveFound(); shared.selected = null; showDetail(null); renderDiscover(); syncViews();
});

/* ---------- 시작 ---------- */
setNow({ quiet: true });
// 첫 화면은 입체 우주. 링크로 별자리를 골라 왔으면 그 별자리를 중심으로 연다
const q = new URLSearchParams(location.search).get("c");
const top = dome.visibleConstellations(20)[0];
if (top && sky) { sky.yaw = top.center.az; sky.pitch = Math.min(60, Math.max(20, top.center.alt - 10)); }
if (q && CONST_BY_ID[q]) { shared.selected = q; syncViews(); showDetail(CONST_BY_ID[q], true); renderVisible(); }
/* 운세 페이지에서 건너온 링크: 그 순간(t), 그 장소(lat, lon), 그 천체(p) 또는 별(s)의 실제 하늘 */
const P = new URLSearchParams(location.search);
const linkT = Number(P.get("t")), linkP = P.get("p"), linkS = P.has("s") ? Number(P.get("s")) : null;
if (P.has("lat") && P.has("lon")) {
  const custom = { id: "link", ko: P.get("place") || "지정한 곳", lat: Number(P.get("lat")), lon: Number(P.get("lon")), tz: 9 };
  places.push(custom); sel.add(new Option(custom.ko, places.length - 1)); sel.value = places.length - 1; place = custom;
}
if (Number.isFinite(linkT) && linkT > 0) {
  // 저녁 6시부터 센 분으로 바꾼다 (오후 6시 전이면 전날 저녁부터 센다)
  const loc = new Date(linkT + place.tz * 3600000), h = loc.getUTCHours();
  const base = new Date(Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate() - (h < 18 ? 1 : 0)));
  evening = { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
  minutes = (((h - 18 + 24) % 24) * 60) + loc.getUTCMinutes();
  $("#obs-date").value = `${evening.y}-${String(evening.m).padStart(2, "0")}-${String(evening.d).padStart(2, "0")}`;
  $("#obs-time").value = Math.min(720, minutes);
  update();
}
const linked = Number.isFinite(linkT) && linkT > 0 || linkS != null;
setView(sky ? (linked && (P.get("view") === "look" || linkP || linkS != null) ? "look" : "space") : "dome");
// 첫 화면은 지구에서 시작한다 (링크로 별자리를 골라 왔으면 그 별자리)
if (sky && !linked && !(q && CONST_BY_ID[q])) sky.startAtEarth();
if (sky && linked) {
  const dt = new Date(obsTime() + place.tz * 3600000);
  const when = `${dt.getUTCFullYear()}년 ${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일 ${timeLabel(minutes)}`;
  if (linkS != null && SKY_STARS[linkS]) {
    const aa = starAltAz(linkS);
    showStar(linkS, true); popStar(linkS);
    if (aa.alt > 0) sky.lookAtStar(linkS);
    else { setView("space"); setTimeout(() => sky.orbitStar(linkS), 600); toast(`${topic(starName(linkS) || "이 별")} 지금 지평선 아래라 입체 우주에서 보여 드립니다.`); }
  } else if (linkP === "moon" && sky.moonAA) {
    if (sky.moonAA.alt > 0) sky.turnTo(sky.moonAA.az, Math.max(5, Math.min(85, sky.moonAA.alt)));
    toast(`${when}, ${place.ko}의 하늘입니다. 달은 ${sky.moonAA.alt > 0 ? `${directionName(sky.moonAA.az)} ${altitudeWords(sky.moonAA.alt)}에 있습니다` : "지평선 아래에 있습니다"}.`);
  } else if (linkP && linkP !== "sun") {
    const pl = sky.planets.find((x) => x.id === linkP);
    if (pl && pl.alt > 0) { sky.turnTo(pl.az, Math.max(5, Math.min(85, pl.alt))); showPlanet(linkP, true); popPlanet(linkP); toast(`${when}, ${place.ko}의 하늘: ${topic(pl.ko)} ${directionName(pl.az)} ${altitudeWords(pl.alt)}에 있습니다.`); }
    else if (pl) { setView("space"); setTimeout(() => sky.orbitPlanet(linkP), 600); toast(`${when}: ${topic(pl.ko)} 지평선 아래라 태양계에서 보여 드립니다.`); }
  } else {
    toast(`${when}, ${place.ko}의 실제 하늘입니다.${dome.sun.alt > 0 ? " 낮이라 별은 흐리게만 보입니다." : ""}`);
  }
}
if (document.fonts) document.fonts.ready.then(() => dome.draw());
