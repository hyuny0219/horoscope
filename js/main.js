(function () {
  const $ = (sel) => document.querySelector(sel);
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
  }

  const wheel = new StarWheel($("#wheel"), { onChange: updatePlate });
  if (document.fonts) document.fonts.ready.then(() => { wheel.dirty = true; });
  $("#plate-today").addEventListener("click", () => wheel.goToToday());
  plate.cta.addEventListener("click", () => {
    selectSign(plateSign);
    $("#reading").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  /* ---------- 운세 ---------- */
  const today = new Date();
  const PROFILE_KEY = "byeoljaripan.profile", CARD_KEY = "byeoljaripan.cards";
  const loadJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  let profile = loadJSON(PROFILE_KEY, null); // {birth, chart}
  let current = profile ? profile.chart.sun : signIndexForDate(today.getMonth() + 1, today.getDate());
  const asked = SIGNS.findIndex((s) => s.id === new URLSearchParams(location.search).get("sign"));
  if (asked >= 0) current = asked;
  let dayOffset = 0;
  const signLabel = (i) => `${SIGNS[i].glyph} ${SIGNS[i].ko}`;

  const picker = $("#picker");
  SIGNS.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pick";
    b.setAttribute("role", "radio");
    b.dataset.index = i;
    b.innerHTML = `<span class="pick-frame" aria-hidden="true"><span class="pick-glyph">${s.glyph}</span></span><span class="pick-name">${s.ko}</span><span class="pick-range">${fmtRange(i)}</span>`;
    b.addEventListener("click", () => selectSign(i));
    picker.appendChild(b);
  });

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
  const placeSel = $("#birth-place");
  PLACES.forEach((p, i) => placeSel.add(new Option(p.ko, i)));
  placeSel.add(new Option("그 밖의 곳 (서울 기준으로 계산)", 0));

  $("#chart-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#birth-date").value;
    if (!v) return;
    const [y, m, d] = v.split("-").map(Number);
    const t = $("#birth-time").value;
    const pl = PLACES[Number(placeSel.value)] || PLACES[0];
    const birth = { y, m, d, lat: pl.lat, lon: pl.lon, tz: 9, place: pl.ko };
    if (t) { const [hh, mm] = t.split(":").map(Number); birth.hh = hh; birth.mm = mm; }
    profile = { birth, chart: birthChart(birth) };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    current = profile.chart.sun;
    renderChart(); renderReading();
    $("#compat-me").value = v;
  });

  function renderChart() {
    const box = $("#chart-result");
    if (!profile) { box.hidden = true; return; }
    const { birth, chart } = profile;
    box.hidden = false;
    const tile = (title, i, sub) => `<div class="chart-tile">
      <p class="chart-tile-title">${title}</p>
      <p class="chart-tile-sign">${i == null ? "모름" : signLabel(i)}</p>
      <p class="chart-tile-sub">${sub}</p></div>`;
    box.innerHTML = `
      <p class="chart-who">${birth.y}년 ${birth.m}월 ${birth.d}일${Number.isFinite(birth.hh) ? ` ${birth.hh}시 ${birth.mm}분` : ""}, ${birth.place}</p>
      <div class="chart-tiles">
        ${tile("태양궁, 나의 성격", chart.sun, SIGNS[chart.sun].keyword)}
        ${tile("달궁, 나의 감정", chart.moon, MOON_IN[chart.moon])}
        ${tile("상승궁, 남이 보는 나", chart.rising, chart.rising == null ? "태어난 시각을 넣으면 계산합니다" : RISING_IN[chart.rising])}
      </div>
      <button type="button" class="link-btn" id="chart-clear">별 지도 지우기</button>`;
    $("#chart-clear").addEventListener("click", () => { profile = null; localStorage.removeItem(PROFILE_KEY); renderChart(); renderReading(); });
    $("#birth-date").value = `${birth.y}-${String(birth.m).padStart(2, "0")}-${String(birth.d).padStart(2, "0")}`;
    if (Number.isFinite(birth.hh)) $("#birth-time").value = `${String(birth.hh).padStart(2, "0")}:${String(birth.mm).padStart(2, "0")}`;
  }

  /* ----- 운세 해설지 ----- */
  function renderReading() {
    picker.querySelectorAll(".pick").forEach((b) => {
      const on = Number(b.dataset.index) === current;
      b.setAttribute("aria-checked", on);
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll(".day-tab").forEach((t) => t.setAttribute("aria-pressed", Number(t.dataset.offset) === dayOffset));

    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const mine = profile && profile.chart.sun === current ? profile.chart : null;
    const f = makeFortune(current, date, mine);
    const [overall, ...rest] = f.categories;
    const L = f.lucky;
    const wk = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    const sky = f.sky;

    $("#reading-out").innerHTML = `
      <header class="r-head">
        <p class="r-date">${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${wk}요일</p>
        <h3 class="r-sign"><span aria-hidden="true">${f.sign.glyph}</span> ${f.sign.ko}</h3>
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
    renderCards(date);
  }
  bindChartTips($("#reading-out"));

  /* ----- 별 카드 ----- */
  function renderCards(date) {
    const key = `${dateKey(date)}:${SIGNS[current].id}`;
    const picked = loadJSON(CARD_KEY, {})[key];
    const cards = starCardsFor(current, date);
    const row = $("#card-row");
    row.replaceChildren();
    $("#cards-intro").textContent = picked == null
      ? `${SIGNS[current].ko}의 ${date.getMonth() + 1}월 ${date.getDate()}일 카드입니다. 마음이 가는 한 장을 고르세요. 하루에 한 번만 뒤집을 수 있습니다.`
      : "오늘의 카드를 이미 뒤집었습니다. 내일 다시 오세요.";
    cards.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "star-card" + (picked === i ? " is-open" : picked != null ? " is-dim" : "");
      b.disabled = picked != null;
      b.setAttribute("aria-label", picked === i ? `${c.star} 카드: ${c.msg}` : `${i + 1}번 카드 뒤집기`);
      b.innerHTML = `<span class="star-card-inner">
        <span class="star-card-back" aria-hidden="true"><svg class="star-card-mark" viewBox="0 0 40 40" width="44" height="44"><path d="M20 2 L23.5 16.5 L38 20 L23.5 23.5 L20 38 L16.5 23.5 L2 20 L16.5 16.5 Z" fill="currentColor"/></svg></span>
        <span class="star-card-front"><span class="star-card-star">${c.star}</span><span class="star-card-con">${c.con}</span><span class="star-card-msg">${c.msg}</span></span>
      </span>`;
      b.addEventListener("click", () => {
        const all = loadJSON(CARD_KEY, {});
        all[key] = i;
        localStorage.setItem(CARD_KEY, JSON.stringify(all));
        renderCards(date);
      });
      row.appendChild(b);
    });
  }

  /* ----- 궁합 ----- */
  $("#compat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const parse = (v) => { const [y, m, d] = v.split("-").map(Number); return birthChart({ y, m, d, lat: 37.57, lon: 126.98, tz: 9 }); };
    const me = $("#compat-me").value, you = $("#compat-you").value;
    if (!me || !you) return;
    const a = profile && $("#compat-me").value === $("#birth-date").value ? profile.chart : parse(me);
    const b = parse(you);
    const c = compatibility(a, b);
    const words = COMPAT_TEXT.find((t) => c.total >= t.min).text;
    const out = $("#compat-out");
    out.hidden = false;
    out.innerHTML = `
      <div class="compat-score"><span class="compat-num">${c.total}</span><span class="compat-unit">점</span></div>
      <div class="compat-body">
        <p class="compat-pair">${signLabel(a.sun)}와 ${signLabel(b.sun)}</p>
        <p>${words}</p>
        <div class="meters">
          ${meter("성격 (태양)", c.sunScore)}
          ${meter("감정 (달)", c.moonScore)}
          ${meter("원소", c.elementScore)}
        </div>
        <p class="compat-note">태양끼리는 ${c.sunAspect.name}, 달끼리는 ${signLabel(a.moon)}와 ${signLabel(b.moon)}로 ${c.moonAspect.name} 관계입니다.</p>
      </div>`;
  });
  bindChartTips($("#compat-out"));
  if (profile) $("#compat-me").value = $("#birth-date").value;

  // 라디오 그룹 키보드 이동
  picker.addEventListener("keydown", (e) => {
    const n = SIGNS.length;
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (current + 1) % n;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (current - 1 + n) % n;
    if (next === null) return;
    e.preventDefault();
    selectSign(next);
    picker.querySelector(`[data-index="${next}"]`).focus();
  });

  renderChart();
  renderReading();
  if (profile) $("#compat-me").value = $("#birth-date").value;
})();
