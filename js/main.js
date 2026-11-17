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
    plate.sky.href = `sky.html?c=${s.iau}`;
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
  let current = signIndexForDate(today.getMonth() + 1, today.getDate());
  const asked = SIGNS.findIndex((s) => s.id === new URLSearchParams(location.search).get("sign"));
  if (asked >= 0) current = asked;
  let dayOffset = 0;

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

  $("#birthday").addEventListener("change", (e) => {
    const v = e.target.value; // YYYY-MM-DD
    const msg = $("#birthday-result");
    if (!v) { msg.textContent = ""; return; }
    const [, m, d] = v.split("-").map(Number);
    const i = signIndexForDate(m, d);
    msg.textContent = `${m}월 ${d}일생은 ${SIGNS[i].ko}입니다.`;
    selectSign(i);
  });

  document.querySelectorAll(".day-tab").forEach((t) => {
    t.addEventListener("click", () => {
      dayOffset = Number(t.dataset.offset);
      renderReading();
    });
  });

  function selectSign(i) {
    current = i;
    renderReading();
  }

  function scoreMarks(score) {
    let html = "";
    for (let k = 1; k <= 5; k++) html += `<span class="mark${k <= score ? " on" : ""}"></span>`;
    return `<span class="marks" role="img" aria-label="5점 만점에 ${score}점">${html}</span>`;
  }

  function renderReading() {
    picker.querySelectorAll(".pick").forEach((b) => {
      const on = Number(b.dataset.index) === current;
      b.setAttribute("aria-checked", on);
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll(".day-tab").forEach((t) => t.setAttribute("aria-pressed", Number(t.dataset.offset) === dayOffset));

    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const f = makeFortune(current, date);
    const [overall, ...rest] = f.categories;
    const L = f.lucky;
    const week = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];

    $("#reading-out").innerHTML = `
      <header class="r-head">
        <p class="r-date">${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${week}요일</p>
        <h3 class="r-sign"><span aria-hidden="true">${f.sign.glyph}</span> ${f.sign.ko}</h3>
      </header>
      <section class="r-overall">
        <h4>${overall.label} ${scoreMarks(overall.score)}</h4>
        <p>${overall.text}</p>
        <p class="r-advice">${f.advice}</p>
      </section>
      <div class="r-cats">
        ${rest.map((c) => `<section class="r-cat"><h4>${c.label} ${scoreMarks(c.score)}</h4><p>${c.text}</p></section>`).join("")}
      </div>
      <dl class="r-lucky">
        <div><dt>행운의 색</dt><dd><span class="swatch" style="background:${L.color.hex}"></span>${L.color.name}</dd></div>
        <div><dt>행운의 숫자</dt><dd>${L.number}</dd></div>
        <div><dt>좋은 방향</dt><dd>${L.direction}</dd></div>
        <div><dt>좋은 시간</dt><dd>${L.time}</dd></div>
        <div><dt>행운의 물건</dt><dd>${L.item}</dd></div>
        <div><dt>잘 맞는 별자리</dt><dd>${L.match.glyph} ${L.match.ko}</dd></div>
      </dl>`;
  }

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

  renderReading();

})();
