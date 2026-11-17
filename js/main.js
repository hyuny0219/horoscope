(function () {
  const $ = (sel) => document.querySelector(sel);
  const bind = (sel, ev, fn) => document.querySelector(sel)?.addEventListener(ev, fn); // 요소가 없으면 건너뛴다
  const fmtRange = (i) => {
    const r = SIGN_RANGES[i];
    const a = doyToDate(r.start), b = doyToDate(r.end - 1);
    return `${a.month}월 ${a.day}일 ~ ${b.month}월 ${b.day}일`;
  };

  /* ---------- 성좌판 해설 ---------- */
  let plateSign = -1;
  const plate = {
    date: $("#plate-date"), name: $("#plate-name"), latin: $("#plate-latin"),
    range: $("#plate-range"), element: $("#plate-element"), planet: $("#plate-planet"), keyword: $("#plate-keyword"),
    traits: $("#plate-traits"), myth: $("#plate-myth"), cta: $("#plate-cta"), sky: $("#plate-sky"),
  };

  function updatePlate(doy, i) {
    const { month, day } = doyToDate(doy);
    const isToday = doy === wheel.todayDoy;
    plate.date.textContent = isToday ? `오늘, ${month}월 ${day}일의 태양` : `${month}월 ${day}일의 태양`;
    $("#plate-today").hidden = isToday;
    if (i === plateSign) return;
    plateSign = i;
    const s = SIGNS[i];
    plate.name.textContent = s.ko;
    plate.latin.textContent = `${s.glyph} ${s.latin}`;
    plate.range.textContent = fmtRange(i);
    plate.element.textContent = s.element;
    plate.planet.textContent = s.planet;
    plate.keyword.textContent = s.keyword;
    plate.traits.textContent = s.traits;
    plate.myth.textContent = s.myth;
    plate.cta.textContent = `${s.ko} 운세 보기`;
    plate.sky.href = `index.html?c=${s.iau}`;
    // 원판이 곧 별자리 고르기: 지침이 가리키는 별자리의 운세로 바뀐다
    if (typeof selectSign === "function" && ready && i !== current) selectSign(i);
  }
  let ready = false;

  const wheel = new StarWheel($("#wheel"), { onChange: updatePlate });
  if (document.fonts) document.fonts.ready.then(() => { wheel.dirty = true; });
  bind("#plate-today", "click", () => wheel.goToToday());
  plate.cta.addEventListener("click", () => {
    selectSign(plateSign);
    $("#reading-out").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  /* ---------- 운세 ---------- */
  const today = new Date();
  const PROFILE_KEY = "byeoljaripan.profile";
  try { localStorage.removeItem("byeoljaripan.cards"); } catch (err) {}
  const loadJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  // 생일·성별은 저장하지 않는다: 새로고침하면 다시 입력 (예전에 저장된 값도 지움)
  try { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem("byeolnuri.gender"); } catch (err) {}
  let profile = null; // {birth, chart}
  let current = profile ? profile.chart.sun : signIndexForDate(today.getMonth() + 1, today.getDate());
  const asked = SIGNS.findIndex((s) => s.id === new URLSearchParams(location.search).get("sign"));
  if (asked >= 0) current = asked;
  let dayOffset = 0;
  const signLabel = (i) => `${SIGNS[i].glyph} ${SIGNS[i].ko}`;


  document.querySelectorAll(".day-tab").forEach((t) => {
    t.addEventListener("click", () => { dayOffset = Number(t.dataset.offset); renderReading(); });
  });

  function selectSign(i) { current = i; renderReading(); }

  function scoreMarks(score) {
    let html = "";
    for (let k = 1; k <= 5; k++) html += `<span class="mark${k <= score ? " on" : ""}"></span>`;
    return `<span class="marks" role="img" aria-label="5점 만점에 ${score}점">${html}</span>`;
  }

  /* ----- 내 별 지도 ----- */
  // 출생지: 나라 → 도시 (전세계)
  const birthPick = WorldPlace.bind($("#birth-country"), $("#birth-city"), profile?.birth?.cc ? { cc: profile.birth.cc, city: profile.birth.city } : undefined);
  const startPick = WorldPlace.bind($("#start-country"), $("#start-city"), profile?.birth?.cc ? { cc: profile.birth.cc, city: profile.birth.city } : undefined);
  const compatMePick = WorldPlace.bind($("#compat-me-country"), $("#compat-me-city"));
  const compatYouPick = WorldPlace.bind($("#compat-you-country"), $("#compat-you-city"));

  bind("#chart-form", "submit", (e) => {
    e.preventDefault();
    const v = $("#birth-date").value;
    if (!v) return;
    const pl = birthPick.get();
    const birth = WorldPlace.toBirth(v, $("#birth-time").value, pl);
    birth.city = pl.city;
    window.BYEOL_GENDER = $("#birth-gender").value;
    profile = { birth, chart: birthChart(birth) };
    current = profile.chart.sun;
    wheel.goToSign(current);
    renderChart(); renderReading();
    $("#compat-me").value = v;
  });

  function renderChart() {
    Pro.update({ profile });
    $("#chart-empty").hidden = !!profile;
    renderBasis();
    if (!profile) return;
    const { birth } = profile;
    $("#birth-date").value = `${birth.y}-${String(birth.m).padStart(2, "0")}-${String(birth.d).padStart(2, "0")}`;
    if (Number.isFinite(birth.hh)) $("#birth-time").value = `${String(birth.hh).padStart(2, "0")}:${String(birth.mm).padStart(2, "0")}`;
    // 예전에 저장한 별 지도(한국 도시 이름만 있음)도 나라·도시로 맞춘다
    const where = { cc: birth.cc || "KR", city: birth.city || birth.place };
    birthPick.set(where); startPick.set(where);
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#chart-clear")) return;
    profile = null; renderChart(); renderReading();
  });

  /* 운세 기준: 태양궁 / 달궁 / 상승궁 (CHANI처럼 상승궁 기준으로 읽기도 한다) */
  function renderBasis() {
    const box = $("#basis");
    const N = Pro.natal;
    if (!N) { box.hidden = true; return; }
    const opts = [["태양궁", N.sky.sun.sign], ["달궁", N.sky.moon.sign], ...(N.asc ? [["상승궁", N.asc.sign]] : [])];
    box.hidden = false;
    box.innerHTML = `<span class="basis-label">내 운세 기준</span>${opts.map(([k, i]) => `<button type="button" class="basis-btn" data-sign="${i}" aria-pressed="${i === current}">${k} ${SIGNS[i].glyph} ${SIGNS[i].ko}</button>`).join("")}`;
  }
  bind("#basis", "click", (e) => {
    const b = e.target.closest(".basis-btn");
    if (!b) return;
    const i = Number(b.dataset.sign);
    current = i; wheel.goToSign(i); renderReading();
  });

  /* ----- 운세 해설지 ----- */
  function renderReading() {
    document.querySelectorAll(".day-tab").forEach((t) => t.setAttribute("aria-pressed", Number(t.dataset.offset) === dayOffset));

    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const mine = profile && profile.chart.sun === current ? profile.chart : null;
    const f = makeFortune(current, date, mine);
    // 내 차트가 있고 지금 보는 별자리가 내 별자리(태양·달·상승) 중 하나면, 점수를 내 하늘로 맞춘다
    const N = Pro.natal;
    const mineSign = N && [N.sky.sun.sign, N.sky.moon.sign, N.asc?.sign].includes(current);
    const mods = mineSign ? Pro.personalMods(date.getTime()) : null;
    if (mods) {
      for (const c of f.categories) {
        const sc = Math.max(1, Math.min(5, Math.round(3 + mods[c.key] * 1.2 + (c.score - 3) * 0.4)));
        if (sc !== c.score) { const arr = FORTUNE_TEXT[c.key][tierOf(sc)]; c.text = arr[hashString(dateKey(date) + c.key) % arr.length]; c.score = sc; }
      }
      f.week.forEach((d) => { if (d.off === 0) d.score = f.categories[0].score; });
    }
    const [overall, ...rest] = f.categories;
    const L = f.lucky;
    const wk = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    const sky = f.sky;

    $("#reading-out").innerHTML = `
      <header class="r-head">
        <p class="r-date">${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${wk}요일</p>
        <h3 class="r-sign"><span aria-hidden="true">${f.sign.glyph}</span> ${f.sign.ko} 운세</h3>
        <p class="r-note">${mods ? "내 출생 차트의 오늘 흐름을 반영한 점수입니다." : N ? "같은 별자리 모두에게 해당하는 운세입니다." : "생년월일을 넣으면 내 출생 차트에 맞춘 점수로 바뀝니다."}</p>
        ${f.birthdaySeason ? `<p class="r-badge">지금 태양이 ${f.sign.ko}에 머무는 생일 시즌입니다</p>` : ""}
      </header>

      <section class="r-sky" aria-label="오늘의 실제 하늘">
        <p class="r-sky-line">오늘 달은 <strong>${signLabel(sky.moonSign)}</strong>에 있고, 모양은 <strong>${sky.phase}</strong>입니다. ${f.sign.ko}와는 <strong>${f.aspect.name}</strong> 관계입니다.</p>
        <p>${f.aspect.text} ${PHASE_TEXT[sky.phase] || ""}</p>
        <p class="r-mood">오늘 하늘의 분위기는 ${MOON_IN[sky.moonSign]}입니다.${f.moonAspect ? ` 내 달궁 ${SIGNS[mine.moon].ko}와는 ${f.moonAspect.name} 관계라, 감정 면에서 ${f.moonAspect.mod > 0 ? "마음이 잘 풀리는" : f.moonAspect.mod < 0 ? "예민해지기 쉬운" : "무난한"} 하루입니다.` : ""}</p>
      </section>

      <section class="r-overall">
        <h4>${overall.label} ${scoreMarks(overall.score)}</h4>
        <p>${overall.text}</p>
        <ul class="r-keywords" aria-label="오늘의 키워드">${f.keywords.map((k) => `<li>${k}</li>`).join("")}</ul>
        <p class="r-advice">${f.advice}</p>
      </section>

      <div class="r-charts">
        <figure><figcaption>시간대별 흐름</figcaption>${slotChart(f.slots, f.best)}</figure>
        <figure><figcaption>앞뒤 사흘 총운</figcaption>${weekChart(f.week)}</figure>
      </div>

      <div class="r-cats">
        ${rest.map((c) => `<section class="r-cat"><h4>${c.label} ${scoreMarks(c.score)}</h4><p>${c.text}</p></section>`).join("")}
      </div>

      <div class="r-todo">
        <p><span class="r-todo-label">오늘의 미션</span>${f.mission}</p>
        <p><span class="r-todo-label">오늘 피할 것</span>${f.avoid}</p>
      </div>

      <dl class="r-lucky">
        <div><dt>행운의 색</dt><dd><span class="swatch" style="background:${L.color.hex}"></span>${L.color.name}</dd></div>
        <div><dt>행운의 숫자</dt><dd>${L.number}</dd></div>
        <div><dt>좋은 방향</dt><dd>${L.direction}</dd></div>
        <div><dt>좋은 시간</dt><dd>${f.bestLabel}</dd></div>
        <div><dt>행운의 물건</dt><dd>${L.item}</dd></div>
        <div><dt>잘 맞는 별자리</dt><dd>${L.match.glyph} ${L.match.ko}</dd></div>
      </dl>`;
    Pro.update({ sign: current, offset: dayOffset });
    document.querySelectorAll(".basis-btn").forEach((x) => x.setAttribute("aria-pressed", Number(x.dataset.sign) === current));
  }
  bindChartTips($("#reading-out"));
  ["#week-out", "#month-out", "#year-out", "#chart-result", "#transits"].forEach((sel) => $(sel) && bindChartTips($(sel)));

  /* ----- 궁합 ----- */
  bind("#compat-form", "submit", (e) => {
    e.preventDefault();
    const me = $("#compat-me").value, you = $("#compat-you").value;
    if (!me || !you) return;
    const bA = WorldPlace.toBirth(me, $("#compat-me-time").value, compatMePick.get()), bB = WorldPlace.toBirth(you, $("#compat-you-time").value, compatYouPick.get());
    const A = natalChart(bA), B = natalChart(bB);
    const a = { sun: A.sky.sun.sign, moon: A.sky.moon.sign }, b = { sun: B.sky.sun.sign, moon: B.sky.moon.sign };
    const c = compatibility(a, b);
    const syn = Pro.renderSynastry(A, B, c.total);
    const words = COMPAT_TEXT.find((t) => syn.total >= t.min).text;
    const out = $("#compat-out");
    out.hidden = false;
    out.innerHTML = `
      <div class="compat-score"><span class="compat-num">${syn.total}</span><span class="compat-unit">점</span></div>
      <div class="compat-body">
        <p class="compat-pair">${signLabel(a.sun)}와 ${signLabel(b.sun)}</p>
        <p>${words}</p>
        <p class="compat-note">태양끼리는 ${c.sunAspect.name}, 달끼리는 ${signLabel(a.moon)}와 ${signLabel(b.moon)}로 ${c.moonAspect.name} 관계입니다.${A.known && B.known ? "" : " 태어난 시각을 넣으면 상승점까지 겹쳐 봅니다."}</p>
        ${syn.html}
      </div>`;
  });
  bindChartTips($("#compat-out"));
  if (profile) {
    $("#compat-me").value = $("#birth-date").value;
    if (Number.isFinite(profile.birth.hh)) $("#compat-me-time").value = $("#birth-time").value;
    if (profile.birth.cc) compatMePick.set({ cc: profile.birth.cc, city: profile.birth.city });
  }


  Pro.init();

  /* ---------- 시작 화면: 생년월일부터 ---------- */
  bind("#start-form", "submit", (e) => {
    e.preventDefault();
    if (!$("#start-date").value) return;
    $("#birth-date").value = $("#start-date").value;
    $("#birth-time").value = $("#start-time").value;
    $("#birth-gender").value = $("#start-gender").value;
    birthPick.set(startPick.get());
    $("#chart-form").requestSubmit();
    $("#hero").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const openPlate = () => {
    const d = $("#plate-more");
    d.open = true;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  bind("#skip-start", "click", openPlate);
  bind("#plate-more", "toggle", () => { window.dispatchEvent(new Event("resize")); wheel.dirty = true; });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-edit-birth]") || e.target.closest("[data-go-start]")) {
      $("#hero-me").hidden = true; $("#hero-start").hidden = false;
      if (profile) {
        $("#start-date").value = $("#birth-date").value; $("#start-time").value = $("#birth-time").value; $("#start-gender").value = $("#birth-gender").value;
      }
      $("#hero").scrollIntoView({ behavior: "smooth", block: "start" });
      $("#start-date").focus({ preventScroll: true });
    }
  });

  renderChart();
  renderReading();
  // 저장한 별 지도나 링크로 고른 별자리가 있으면 원판도 그 별자리로 돌린다
  if (current !== signIndexForDoy(wheel.todayDoy)) wheel.goToSign(current);
  ready = true;
  if (profile) {
    $("#compat-me").value = $("#birth-date").value;
    if (Number.isFinite(profile.birth.hh)) $("#compat-me-time").value = $("#birth-time").value;
    if (profile.birth.cc) compatMePick.set({ cc: profile.birth.cc, city: profile.birth.city });
  }
})();
