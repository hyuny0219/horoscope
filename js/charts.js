/* 운세용 작은 차트 (단일 계열이라 범례 없이 제목이 계열 이름을 대신한다)
 * 표시 색은 어두운 배경 대비 검증한 #BD8730, 글자는 텍스트 색을 쓴다. */
const CHART_MARK = "#BD8730";
const CHART_GRID = "rgba(232,233,240,0.14)";
const CHART_TEXT = "#A3AAC0";

/* 시간대별 흐름: 막대 4개, 높이 = 점수(1~5) */
function slotChart(slots, best) {
  const W = 260, H = 130, base = 104, top = 16, bw = 30, gap = (W - bw * slots.length) / slots.length;
  const y = (s) => base - ((base - top) * s) / 5;
  const bars = slots.map((s, i) => {
    const x = gap / 2 + i * (bw + gap), h = base - y(s.score), r = 4;
    // 끝은 둥글게, 바닥은 기준선에 붙인다
    const path = `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + bw - r} Q${x + bw},${base - h} ${x + bw},${base - h + r} V${base} Z`;
    return `<g class="hit" data-tip="${s.label} ${s.score}/5">
      <rect x="${x - gap / 2}" y="${top - 10}" width="${bw + gap}" height="${base - top + 30}" fill="transparent"/>
      <path d="${path}" fill="${CHART_MARK}"/>
      ${s === best ? `<text x="${x + bw / 2}" y="${base - h - 6}" text-anchor="middle" class="ct-strong">가장 좋음</text>` : ""}
      <text x="${x + bw / 2}" y="${base + 16}" text-anchor="middle" class="ct">${s.label}</text>
    </g>`;
  }).join("");
  const table = `<table class="sr-only"><caption>시간대별 운 흐름</caption><tr>${slots.map((s) => `<th>${s.label}</th>`).join("")}</tr><tr>${slots.map((s) => `<td>${s.score}점</td>`).join("")}</tr></table>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="mini-chart" role="img" aria-label="시간대별 운 흐름. ${best ? `가장 좋은 때는 ${best.label}입니다.` : "시간대마다 비슷합니다."}">
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="${CHART_GRID}"/>
    ${bars}
  </svg>${table}`;
}

/* 앞뒤 사흘 흐름: 선 하나, 오늘만 점 표시 */
function weekChart(week) {
  const W = 260, H = 130, left = 12, right = W - 12, top = 18, base = 100;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const x = (i) => left + ((right - left) * i) / (week.length - 1);
  const y = (s) => base - ((base - top) * (s - 1)) / 4;
  const pts = week.map((d, i) => `${x(i).toFixed(1)},${y(d.score).toFixed(1)}`).join(" ");
  let ti = week.findIndex((d) => d.sel); if (ti < 0) ti = week.findIndex((d) => d.off === 0);
  const step = (right - left) / (week.length - 1);
  const hits = week.map((d, i) => {
    const label = d.off === 0 ? "오늘" : `${d.date.getMonth() + 1}/${d.date.getDate()}`;
    return `<g class="hit" data-tip="${label} (${days[d.date.getDay()]}) 총운 ${d.score}/5" data-x="${x(i)}">
      <rect x="${x(i) - step / 2}" y="0" width="${step}" height="${H}" fill="transparent"/>
      <line class="crosshair" x1="${x(i)}" x2="${x(i)}" y1="${top - 6}" y2="${base}" stroke="${CHART_GRID}"/>
      <text x="${x(i)}" y="${base + 18}" text-anchor="middle" class="${i === ti ? "ct-strong" : "ct"}">${d.off === 0 ? "오늘" : d.off === -1 ? "어제" : d.off === 1 ? "내일" : days[d.date.getDay()]}</text>
    </g>`;
  }).join("");
  const table = `<table class="sr-only"><caption>7일 총운 흐름</caption>${week.map((d) => `<tr><th>${d.date.getMonth() + 1}월 ${d.date.getDate()}일</th><td>${d.score}점</td></tr>`).join("")}</table>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="mini-chart" role="img" aria-label="앞뒤 사흘의 총운 흐름">
    ${[1, 3, 5].map((v) => `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="${CHART_GRID}" stroke-dasharray="${v === 1 ? "" : "2 4"}"/>`).join("")}
    ${hits}
    <polyline points="${pts}" fill="none" stroke="${CHART_MARK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"/>
    <circle cx="${x(ti)}" cy="${y(week[ti].score)}" r="5" fill="${CHART_MARK}" stroke="#0E1222" stroke-width="2" pointer-events="none"/>
  </svg>${table}`;
}

/* 궁합 세부 점수: 0~100 가로 막대 */
function meter(label, value) {
  return `<div class="meter hit" data-tip="${label} ${value}점">
    <span class="meter-label">${label}</span>
    <span class="meter-track"><span class="meter-fill" style="width:${value}%;background:${CHART_MARK}"></span></span>
    <span class="meter-value">${value}</span>
  </div>`;
}

/* data-tip 요소에 마우스를 올리면 툴팁을 띄운다 */
function bindChartTips(root) {
  // 내용을 innerHTML로 다시 그리면 툴팁도 지워지므로, 쓸 때마다 확인해서 만든다
  const tipEl = () => {
    let t = root.querySelector(":scope > .chart-tip");
    if (!t) { t = document.createElement("div"); t.className = "chart-tip"; t.hidden = true; root.appendChild(t); }
    return t;
  };
  root.addEventListener("pointermove", (e) => {
    const tip = tipEl();
    const h = e.target.closest(".hit");
    root.querySelectorAll(".hit.is-hover").forEach((n) => n !== h && n.classList.remove("is-hover"));
    if (!h) { tip.hidden = true; return; }
    h.classList.add("is-hover");
    const r = root.getBoundingClientRect();
    tip.textContent = h.dataset.tip;
    tip.style.left = `${e.clientX - r.left}px`;
    tip.style.top = `${e.clientY - r.top}px`;
    tip.hidden = false;
  });
  root.addEventListener("pointerleave", () => {
    tipEl().hidden = true;
    root.querySelectorAll(".hit.is-hover").forEach((n) => n.classList.remove("is-hover"));
  });
}
