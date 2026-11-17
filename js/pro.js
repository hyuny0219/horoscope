/* 전문 운세: 오늘의 하늘, 개인 트랜짓, 주간·월간·연간, 출생 차트, 시너스트리 궁합
 * 필요: ephemeris.js, astro-text.js, data.js(SIGNS), charts.js(weekChart, meter), fortune.js(dayScores)
 * 시각은 모두 한국 시간(UTC+9)으로 보여 준다. */
const Pro = (() => {
  const $ = (s) => document.querySelector(s);
  const TZ = 9 * 3600000;
  const kst = (ms) => new Date(ms + TZ); // getUTC*로 읽는다
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const fmtDay = (ms) => { const d = kst(ms); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WD[d.getUTCDay()]})`; };
  const fmtTime = (ms) => { const d = kst(ms), h = d.getUTCHours(), m = d.getUTCMinutes(); return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`; };
  const fmtFull = (ms) => `${fmtDay(ms)} ${fmtTime(ms)}`;
  const fmtShort = (ms) => { const d = kst(ms); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
  const deg = (lon) => { const x = lon % 30, d = Math.floor(x), m = Math.floor((x - d) * 60); return `${d}°${String(m).padStart(2, "0")}′`; };
  const signTag = (i) => `<span class="sg">${SIGNS[i].glyph}</span> ${SIGNS[i].ko}`;
  const houseOf = (sign, base) => ((sign - base + 12) % 12) + 1;
  const houseTag = (h) => `<span class="hs" title="${h}하우스">${HOUSE_TOPIC[h].short}<small>${h}</small></span>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /* 별누리만의 연결: 그 순간의 실제 하늘을 3D로 */
  const skyLink = (ms, extra = "") => `index.html?t=${Math.round(ms)}${extra}`;
  const skyBtn = (ms, label = "그 하늘 보기", extra = "") => `<a class="sky-link" href="${skyLink(ms, extra)}">${label} ↗</a>`;

  const state = { sign: 0, profile: null, natal: null, offset: 0, tab: "today" };

  function natalOf(profile) {
    if (!profile) return null;
    try { return natalChart(profile.birth); } catch { return null; }
  }

  /* ---------- 1. 오늘의 하늘 ---------- */
  function renderSkyNow(ms) {
    const sky = skyAt(ms), base = state.sign;
    const rows = BODIES.map((id) => {
      const b = sky[id], B = BODY_KO[id];
      return `<tr>
        <th scope="row"><span class="pg">${B.glyph}</span> ${B.ko}</th>
        <td>${signTag(b.sign)} <span class="dg">${deg(b.lon)}</span>${b.retro ? ' <span class="rx" title="역행">℞</span>' : ""}</td>
        <td>${houseTag(houseOf(b.sign, base))}</td>
      </tr>`;
    }).join("");
    const voc = voidOfCourse(ms);
    const ing = voc ? voc.end : null;
    const nm = nextLunation(ms, "new"), fm = nextLunation(ms, "full");
    const lun = [nm, fm].sort((a, b) => a.ms - b.ms).map((L) => {
      const t = eventText({ type: L.eclipse ? (L.kind === "new" ? "solarEclipse" : "lunarEclipse") : L.kind, sign: L.sign });
      return `<li><span class="ev-ic">${t.icon}</span><b>${fmtDay(L.ms)}</b> ${t.title} · ${houseTag(houseOf(L.sign, base))} ${skyBtn(L.ms, "하늘 보기", "&p=moon")}</li>`;
    }).join("");
    const retro = BODIES.filter((id) => sky[id].retro).map((id) => BODY_KO[id].ko);
    const vocNow = voc && voc.start && ms >= voc.start && ms < voc.end;
    $("#sky-now").innerHTML = `
      <h3 class="pro-h">오늘의 하늘 <small>${fmtFull(ms)} · 행성들이 지금 어느 별자리에 있는지와, ${SIGNS[base].ko}에게 삶의 어느 부분을 비추는지</small></h3>
      <div class="moon-box ${vocNow ? "is-void" : ""}">
        <p><span class="pg">☽</span> 달은 <b>${signTag(sky.moon.sign)} ${deg(sky.moon.lon)}</b>에 있고, <b>${ing ? fmtFull(ing) : "-"}</b>에 ${signTag((sky.moon.sign + 1) % 12)}로 넘어갑니다.</p>
        ${voc && voc.start ? `<p class="voc">${vocNow ? "지금 " : ""}<b>달의 쉬는 시간</b> ${fmtTime(voc.start)} ~ ${fmtFull(voc.end)} <span class="muted">— 점성술에서 '보이드'라 부르는 시간입니다. 새 일 시작, 계약, 큰 결정은 이 시간을 피하는 것이 전통입니다.</span></p>` : ""}
      </div>
      <div class="table-wrap"><table class="sky-table"><thead><tr><th>천체</th><th>별자리와 도수</th><th>내 삶의 어느 부분</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted small">${retro.length ? `지금 거꾸로 가는 것처럼 보이는(역행, ℞) 행성: ${retro.join(", ")}. 이 행성이 맡은 일은 새로 벌이기보다 다시 살피기에 좋습니다.` : "지금 역행 중인 행성이 없습니다."}</p>
      <ul class="ev-list">${lun}</ul>`;
  }

  /* ---------- 2. 개인 트랜짓 ---------- */
  /* 트랜짓 하나: 쉬운 말 먼저, 점성술 해설은 '왜 그런가요?' 안에 */
  function plainItem(t, ms, exact) {
    const p = plainTransit(t), x = transitSentence(t), tone = PLAIN_TONE[transitCategory(t)];
    return `<li class="pl-item pl-${transitCategory(t)}">
      <p class="pl-tone">${tone.icon} ${tone.ko}</p>
      <p class="pl-title">${p.title}</p>
      <p class="pl-text">${p.text}</p>
      <p class="pl-tip"><b>오늘의 한 가지</b> ${p.tip}</p>
      <details class="pl-why"><summary>왜 그런가요?</summary>
        <p class="small">${techLine(t)}. ${x.phase}${exact ? `, 가장 강한 날은 ${fmtDay(exact)}` : ""}.</p>
        <p class="small">${x.line}</p>
      </details></li>`;
  }
  function exactDateOf(t, ms) {
    const N = state.natal;
    const win = { sun: 4, mercury: 6, venus: 6, mars: 10, jupiter: 60, saturn: 90, uranus: 200, neptune: 300, pluto: 300 }[t.transit];
    if (!win || !N) return null;
    const n = [...N.points, ...(N.asc ? [N.asc, N.mc] : [])].find((p) => p.id === t.natal);
    const hits = exactAspects(ms - win * 86400000, ms + win * 86400000, [{ a: t.transit, b: t.natal, fixed: n.lon }], (win > 30 ? 2 : 0.25) * 86400000)
      .filter((h) => h.aspect.key === t.aspect.key);
    return hits.length ? hits.sort((a, b) => Math.abs(a.ms - ms) - Math.abs(b.ms - ms))[0].ms : null;
  }
  /* 오늘의 핵심 몇 개: 오래가는 영향 먼저, 좋은 흐름과 조심할 흐름을 섞어서 */
  function topTransits(ms, n = 3) {
    const list = transitsNow(ms, state.natal).filter((t) => t.transit !== "moon");
    const out = [], seen = new Set();
    const take = (t) => { const k = t.natal + transitCategory(t); if (!seen.has(k) && out.length < n) { seen.add(k); out.push(t); } };
    const pw = list.filter((t) => transitCategory(t) === "power"), ot = list.filter((t) => transitCategory(t) !== "power");
    for (let i = 0; out.length < n && (i < pw.length || i < ot.length); i++) { if (pw[i]) take(pw[i]); if (ot[i]) take(ot[i]); }
    if (!out.length) { const m = transitsNow(ms, state.natal).find((t) => t.transit === "moon"); if (m) out.push(m); }
    return out;
  }
  function doDont(list) {
    const doL = [...new Set(list.filter((t) => transitCategory(t) === "power").map((t) => TRANSIT_DO[t.transit][0]))].slice(0, 3);
    const dont = [...new Set(list.filter((t) => transitCategory(t) !== "power").map((t) => TRANSIT_DO[t.transit][1]))].slice(0, 3);
    return { doL: doL.length ? doL : ["평소 리듬대로 지내기"], dont: dont.length ? dont : ["무리한 일정 잡기"] };
  }

  function renderTransits(ms) {
    const box = $("#transits");
    const N = state.natal;
    if (!N) {
      box.innerHTML = `<h3 class="pro-h">오늘 나에게 닿는 별</h3>
        <p class="muted">생년월일을 넣으면 오늘 하늘이 <b>내가 태어난 날의 하늘</b>과 만나는 곳을 찾아 나만의 운세를 보여 드립니다.</p>
        <div class="unique-actions"><button type="button" class="btn btn-ink" data-go-start>생년월일 넣기</button><button type="button" class="btn btn-line share-btn" data-share="today">오늘 카드 공유</button></div>`;
      return;
    }
    if (state.offset === 0) { box.innerHTML = ""; return; } // 오늘은 맨 위 '오늘의 나'에 모두 있다
    const list = transitsNow(ms, N);
    const { doL, dont } = doDont(list);
    box.innerHTML = `
      <div class="pro-h-row"><h3 class="pro-h">${state.offset < 0 ? "어제" : "내일"} 나에게 닿는 별 <small>지금 하늘의 행성이 내가 태어난 날의 행성과 만나는 곳 (전체 ${list.length}개)</small></h3><button type="button" class="btn btn-star share-btn" data-share="today">오늘 카드 공유</button></div>
      <ul class="pl-list">${list.slice(0, 8).map((t) => plainItem(t, ms, exactDateOf(t, ms))).join("")}</ul>
      <div class="dodont">
        <div><h4>해 보면 좋은 것</h4><ul>${doL.map((x) => `<li>${x}</li>`).join("")}</ul></div>
        <div><h4>피하면 좋은 것</h4><ul>${dont.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      </div>`;
  }

  /* 내 출생 차트 기준 영역별 보정 (-2 ~ +2): 별자리 공통 운세 점수를 나에게 맞춘다 */
  const AREA_OF = { venus: ["love", "money"], moon: ["love", "health"], mercury: ["work"], saturn: ["work"], mc: ["work"], sun: ["overall", "health"], mars: ["health", "work"], jupiter: ["money", "overall"], asc: ["health", "overall"], uranus: ["overall"], neptune: ["overall"], pluto: ["overall"] };
  function personalMods(ms) {
    const N = state.natal;
    if (!N) return null;
    const mods = { overall: 0, love: 0, money: 0, work: 0, health: 0 };
    for (const t of transitsNow(ms, N)) {
      const w = (t.transit === "moon" ? 0.5 : 1) * (1 - t.orb / 5);
      const v = ({ power: 1, pressure: -0.6, trouble: -1 })[transitCategory(t)] * w;
      for (const k of AREA_OF[t.natal] || ["overall"]) mods[k] += v;
      mods.overall += v * 0.4;
    }
    for (const k in mods) mods[k] = Math.max(-2, Math.min(2, mods[k]));
    return mods;
  }

  /* 맨 위 '오늘의 나' */
  function renderHero() {
    const start = $("#hero-start"), me = $("#hero-me");
    if (!start || !me) return;
    const N = state.natal;
    start.hidden = !!N; me.hidden = !N;
    if (!N) return;
    const ms = Date.now();
    const all = transitsNow(ms, N), top = topTransits(ms, 3);
    const rest = all.filter((t) => t.transit !== "moon" && !top.includes(t));
    const { doL, dont } = doDont(all);
    // 하루 전체의 분위기: 좋은 흐름과 조심할 흐름의 균형
    const slow = all.filter((t) => t.transit !== "moon");
    const bal = slow.reduce((a, t) => a + ({ power: 1, pressure: -0.5, trouble: -1 })[transitCategory(t)], 0);
    const mo = personalMods(ms).overall;
    const mood = mo >= 1.2 ? "별이 밀어 주는 하루" : mo > 0.3 ? "좋은 흐름이 조금 더 많은 하루" : mo > -0.3 ? "좋은 흐름과 조심할 흐름이 섞인 하루" : "한 박자 쉬어 가면 좋은 하루";
    void bal;
    const lead = { title: mood };
    const tag = (label, sign) => sign == null ? "" : `<span class="me-tag"><small>${label}</small> ${signTag(sign)}</span>`;
    me.innerHTML = `
      <p class="me-date">${fmtDay(ms)} · 오늘의 나</p>
      <h1 class="me-title">${lead ? lead.title : "평온하게 흘러가는 하루"}</h1>
      <p class="me-tags">${tag("태양", N.sky.sun.sign)}${tag("달", N.sky.moon.sign)}${tag("상승", N.asc ? N.asc.sign : null)}</p>
      <ul class="pl-list me-list">${top.map((t) => plainItem(t, ms, exactDateOf(t, ms))).join("") || `<li class="pl-item"><p class="pl-text">오늘은 내 별과 크게 부딪히거나 만나는 행성이 없습니다. 내 속도대로 지내기 좋은 날입니다.</p></li>`}</ul>
      ${rest.length ? `<details class="me-more"><summary>오늘의 다른 흐름 ${rest.length}개 더 보기</summary><ul class="pl-list me-list">${rest.map((t) => plainItem(t, ms, exactDateOf(t, ms))).join("")}</ul></details>` : ""}
      <div class="dodont me-dd">
        <div><h4>해 보면 좋은 것</h4><ul>${doL.map((x) => `<li>${x}</li>`).join("")}</ul></div>
        <div><h4>피하면 좋은 것</h4><ul>${dont.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      </div>
      <div class="me-actions">
        <button type="button" class="btn btn-star share-btn" data-share="today">오늘 카드 공유</button>
        <button type="button" class="btn btn-line" data-go-tab="week">이번 주 보기</button>
        <button type="button" class="btn btn-line" data-go-tab="chart">내 차트</button>
        <button type="button" class="link-btn" data-edit-birth>생일 바꾸기</button>
      </div>`;
  }

  /* ---------- 3-1. 이번 주 ---------- */
  function renderWeek() {
    const now = Date.now(), base = state.sign;
    const start = now, end = now + 7 * 86400000;
    const today = new Date();
    const week = [0, 1, 2, 3, 4, 5, 6].map((off) => {
      const d = new Date(today); d.setDate(today.getDate() + off);
      return { off, date: d, score: dayScores(base, d, state.natal ? { moon: state.natal.sky.moon.sign } : null).overall };
    });
    // 달이 지나는 영역 (별자리를 옮기는 정확한 시각으로 나눈다)
    const moonRuns = [];
    for (let t = start, k = 0; t < end && k < 8; k++) {
      const ing = nextMoonIngress(t);
      moonRuns.push({ sign: Math.floor(moonLongitude(t) / 30), from: t, to: ing ? Math.min(ing.ms, end) : end });
      if (!ing) break;
      t = ing.ms + 60000;
    }
    const ev = eventsBetween(start, end);
    const pairs = [];
    const slow = ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
    for (let i = 0; i < slow.length; i++) for (let j = i + 1; j < slow.length; j++) if (i < 5) pairs.push({ a: slow[i], b: slow[j] });
    const mundane = exactAspects(start, end, pairs, 12 * 3600000);
    const personal = state.natal ? exactAspects(start, end, ["sun", "mercury", "venus", "mars"].flatMap((a) => [...state.natal.points.filter((p) => p.id !== "moon"), ...(state.natal.asc ? [state.natal.asc, state.natal.mc] : [])].map((n) => ({ a, b: n.id, fixed: n.lon }))), 12 * 3600000) : [];
    const sunH = houseOf(Math.floor(sunLongitude(now) / 30), base);
    const best = [...week].sort((a, b) => b.score - a.score)[0], worst = [...week].sort((a, b) => a.score - b.score)[0];
    $("#week-out").innerHTML = `
      <h3 class="pro-h">이번 주 운세 <small>${SIGNS[base].glyph} ${SIGNS[base].ko} · ${fmtDay(start)} ~ ${fmtDay(end - 86400000)}</small></h3>
      <p class="lead">태양이 ${houseTag(sunH)}을 지나고 있습니다. ${HOUSE_FOCUS[sunH]}</p>
      <figure class="pro-fig"><figcaption>7일 흐름 (총운)</figcaption>${weekChart(week)}</figure>
      <p class="small">가장 좋은 날 <b>${fmtDay(best.date.getTime())}</b>, 조심할 날 <b>${fmtDay(worst.date.getTime())}</b></p>
      <h4 class="pro-h4">달이 지나는 영역</h4>
      <ul class="run-list">${moonRuns.map((r) => `<li><span class="when">${fmtShort(r.from)} ${fmtTime(r.from)} ~</span> ${signTag(r.sign)} · ${houseTag(houseOf(r.sign, base))}<br><span class="muted small">${HOUSE_FOCUS[houseOf(r.sign, base)]}</span></li>`).join("")}</ul>
      <h4 class="pro-h4">이번 주 하늘의 사건</h4>
      <ul class="ev-list">${[...ev.map((e) => ({ ms: e.ms, html: (() => { const t = eventText(e); return `<span class="ev-ic">${t.icon}</span><b>${fmtFull(e.ms)}</b> ${t.title} — ${t.text}`; })() })),
        ...mundane.map((x) => ({ ms: x.ms, html: `<span class="ev-ic">${BODY_KO[x.a].glyph}${x.aspect.sym}${BODY_KO[x.b].glyph}</span><b>${fmtFull(x.ms)}</b> ${BODY_KO[x.a].ko} ${x.aspect.ko} ${BODY_KO[x.b].ko} — ${mundaneText(x.a, x.b, x.aspect)}` }))]
        .sort((a, b) => a.ms - b.ms).map((x) => `<li>${x.html} ${skyBtn(x.ms, "하늘")}</li>`).join("") || "<li class='muted'>큰 사건 없이 조용한 한 주입니다.</li>"}</ul>
      ${state.natal ? `<h4 class="pro-h4">나에게 정확히 닿는 날</h4><ul class="ev-list">${personal.map((x) => { const s = transitSentence({ transit: x.a, natal: x.b, aspect: x.aspect, applying: true }); return `<li><span class="ev-ic">${BODY_KO[x.a].glyph}${x.aspect.sym}${BODY_KO[x.b].glyph}</span><b>${fmtFull(x.ms)}</b> ${s.headline}<br><span class="small">${s.short}</span></li>`; }).join("") || "<li class='muted'>이번 주에는 빠른 행성이 내 차트와 정확히 만나는 날이 없습니다.</li>"}</ul>` : `<p class="muted small">내 차트를 만들면 이번 주 나에게 정확히 닿는 행성의 날짜도 보여 드립니다.</p>`}`;
  }

  /* ---------- 3-2. 이번 달 (달력) ---------- */
  function renderMonth() {
    const base = state.sign, now = new Date(Date.now() + TZ);
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    const t0 = Date.UTC(y, m, 1) - TZ, t1 = Date.UTC(y, m + 1, 1) - TZ;
    const ev = eventsBetween(t0, t1);
    const byDay = {};
    for (const e of ev) { const d = kst(e.ms).getUTCDate(); (byDay[d] = byDay[d] || []).push(e); }
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), first = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const scores = [];
    for (let d = 1; d <= days; d++) scores.push({ d, s: dayScores(base, new Date(y, m, d), null).overall });
    const lucky = [...scores].sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.d).sort((a, b) => a - b);
    const careful = [...scores].sort((a, b) => a.s - b.s).slice(0, 2).map((x) => x.d).sort((a, b) => a - b);
    let cells = "";
    for (let i = 0; i < first; i++) cells += `<div class="cal-cell is-empty"></div>`;
    for (let d = 1; d <= days; d++) {
      const evs = byDay[d] || [];
      const isToday = d === now.getUTCDate();
      cells += `<div class="cal-cell${isToday ? " is-today" : ""}${lucky.includes(d) ? " is-lucky" : ""}${careful.includes(d) ? " is-careful" : ""}">
        <span class="cal-d">${d}</span>
        <span class="cal-ev">${evs.map((e) => `<span title="${esc(eventText(e).title)}">${eventText(e).icon}</span>`).join("")}</span></div>`;
    }
    const sunStart = Math.floor(sunLongitude(t0) / 30), sunEnd = Math.floor(sunLongitude(t1 - 1) / 30);
    const lunations = ev.filter((e) => ["new", "full", "solarEclipse", "lunarEclipse"].includes(e.type));
    const retros = ["mercury", "venus", "mars"].filter((id) => bodySpeed(id, t0) < 0 || bodySpeed(id, t1) < 0 || ev.some((e) => e.body === id && e.type.startsWith("station")));
    $("#month-out").innerHTML = `
      <h3 class="pro-h">${m + 1}월 운세 <small>${SIGNS[base].glyph} ${SIGNS[base].ko}</small></h3>
      <p class="lead">태양이 ${houseTag(houseOf(sunStart, base))}${sunEnd !== sunStart ? `에서 ${houseTag(houseOf(sunEnd, base))}로 옮겨 갑니다` : "을 지납니다"}. ${HOUSE_FOCUS[houseOf(sunEnd, base)]}</p>
      ${lunations.map((e) => { const t = eventText(e), h = houseOf(e.sign, base); return `<p><span class="ev-ic">${t.icon}</span><b>${fmtDay(e.ms)} ${t.title}</b> — ${houseTag(h)}: ${e.type === "new" || e.type === "solarEclipse" ? "이 영역에서 새 출발을 계획하세요." : "이 영역의 일이 결실을 맺거나 정리됩니다."}</p>`; }).join("")}
      ${retros.length ? `<p class="small">역행: ${retros.map((id) => `${BODY_KO[id].ko} (${houseTag(houseOf(Math.floor(bodyLongitude(id, t0) / 30), base))})`).join(", ")} — 이 영역은 다시 보고 고치기에 좋습니다.</p>` : ""}
      <div class="cal" role="grid" aria-label="${m + 1}월 하늘 달력">
        ${WD.map((w) => `<div class="cal-h">${w}</div>`).join("")}${cells}
      </div>
      <p class="cal-legend small"><span class="lg lg-lucky"></span>좋은 날 ${lucky.join(", ")}일 · <span class="lg lg-careful"></span>조심할 날 ${careful.join(", ")}일 · ● 새달 ○ 보름 ◐◑ 식 ℞ 역행</p>
      <h4 class="pro-h4">이달의 주요 날짜</h4>
      <ul class="ev-list">${ev.map((e) => { const t = eventText(e); return `<li><span class="ev-ic">${t.icon}</span><b>${fmtFull(e.ms)}</b> ${t.title} · ${houseTag(houseOf(e.sign, base))}<br><span class="small muted">${t.text}</span> ${skyBtn(e.ms, "하늘", e.body ? `&p=${e.body}` : "")}</li>`; }).join("")}</ul>`;
  }

  /* ---------- 3-3. 올해 (앞으로 12개월) ---------- */
  function renderYear() {
    const base = state.sign, t0 = Date.now(), t1 = t0 + 365 * 86400000;
    const ev = eventsBetween(t0, t1, { bodies: ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] });
    const big = (id, title, desc) => {
      const now = Math.floor(bodyLongitude(id, t0) / 30);
      const moves = ev.filter((e) => e.body === id && e.type === "ingress");
      return `<section class="yr-card"><h4>${BODY_KO[id].glyph} ${title}</h4>
        <p>지금 ${signTag(now)} · ${houseTag(houseOf(now, base))}${bodySpeed(id, t0) < 0 ? " ℞" : ""}</p>
        <p class="small">${desc} ${HOUSE_FOCUS[houseOf(now, base)]}</p>
        ${moves.map((e) => `<p class="small">→ <b>${fmtDay(e.ms)}</b> ${signTag(e.sign)} · ${houseTag(houseOf(e.sign, base))}${e.retro ? " (역행으로 되돌아감)" : ""}</p>`).join("")}</section>`;
    };
    const retroPeriods = (id) => {
      const out = [], st = ev.filter((e) => e.body === id && (e.type === "stationR" || e.type === "stationD"));
      let open = bodySpeed(id, t0) < 0 ? { from: t0, sign: Math.floor(bodyLongitude(id, t0) / 30) } : null;
      for (const e of st) {
        if (e.type === "stationR") open = { from: e.ms, sign: e.sign };
        else if (open) { out.push({ ...open, to: e.ms }); open = null; }
      }
      if (open) out.push({ ...open, to: null });
      return out;
    };
    const allEclipses = eventsBetween(t0, t1, { bodies: [] }).filter((e) => e.type.endsWith("Eclipse"));
    $("#year-out").innerHTML = `
      <h3 class="pro-h">앞으로 1년 <small>${SIGNS[base].glyph} ${SIGNS[base].ko} · ${fmtDay(t0)} ~</small></h3>
      <div class="yr-grid">
        ${big("jupiter", "목성: 행운이 넓어지는 영역", "목성은 한 별자리에 약 1년 머물며 그 영역을 키웁니다.")}
        ${big("saturn", "토성: 시험과 성장의 영역", "토성은 약 2년 반 머물며 그 영역에서 책임과 결과를 요구합니다.")}
      </div>
      <h4 class="pro-h4">일식과 월식 (큰 전환점)</h4>
      <ul class="ev-list">${allEclipses.map((e) => { const t = eventText(e); return `<li><span class="ev-ic">${t.icon}</span><b>${fmtFull(e.ms)}</b> ${t.title} · ${houseTag(houseOf(e.sign, base))}<br><span class="small muted">${t.text}. 실제로 보이는지는 지역마다 다릅니다.</span> ${skyBtn(e.ms, "하늘", "&p=moon")}</li>`; }).join("") || "<li class='muted'>1년 안에 식이 없습니다.</li>"}</ul>
      <h4 class="pro-h4">역행 기간</h4>
      <ul class="ev-list">${["mercury", "venus", "mars", "jupiter", "saturn"].flatMap((id) => retroPeriods(id).map((r) => `<li><span class="ev-ic">${BODY_KO[id].glyph}℞</span><b>${BODY_KO[id].ko}</b> ${r.from === t0 ? "지금" : fmtDay(r.from)} ~ ${r.to ? fmtDay(r.to) : "1년 뒤까지"} · ${signTag(r.sign)} · ${houseTag(houseOf(r.sign, base))}</li>`)).join("")}</ul>
      <h4 class="pro-h4">세대의 행성</h4>
      <p class="small">${["uranus", "neptune", "pluto"].map((id) => `${BODY_KO[id].ko} ${signTag(Math.floor(bodyLongitude(id, t0) / 30))} (${houseTag(houseOf(Math.floor(bodyLongitude(id, t0) / 30), base))})`).join(" · ")} — 몇 년~십수 년에 걸친 느린 변화입니다.</p>`;
  }

  /* ---------- 2-1. 출생 차트 ---------- */
  function wheelSVG(N) {
    const S = 320, c = S / 2, R1 = 150, R2 = 122, R3 = 92;
    const rot = N.asc ? 180 + N.asc.lon : 180; // 상승점(또는 양자리 0°)을 왼쪽에
    const P = (lon, r) => { const a = (rot - lon) * DEG; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
    let g = `<circle cx="${c}" cy="${c}" r="${R1}" class="wh-ring"/><circle cx="${c}" cy="${c}" r="${R2}" class="wh-ring"/><circle cx="${c}" cy="${c}" r="${R3}" class="wh-ring2"/>`;
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = P(i * 30, R2), [x2, y2] = P(i * 30, R1), [tx, ty] = P(i * 30 + 15, (R1 + R2) / 2);
      g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wh-tick"/><text x="${tx}" y="${ty}" class="wh-sign el-${SIGNS[i].element}">${SIGNS[i].glyph}</text>`;
    }
    // 각도 선
    const pts = N.points;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = aspectOf(pts[i].lon, pts[j].lon, ["sun", "moon"].includes(pts[i].id) || ["sun", "moon"].includes(pts[j].id) ? 7 : 5);
      if (!a || a.key === "conj") continue;
      const [x1, y1] = P(pts[i].lon, R3), [x2, y2] = P(pts[j].lon, R3);
      g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wh-asp ${a.nature}"/>`;
    }
    // 천체 기호 (겹치면 안쪽으로 밀어낸다)
    const placed = [];
    for (const p of [...pts].sort((a, b) => a.lon - b.lon)) {
      let r = (R2 + R3) / 2 + 4;
      while (placed.some((q) => angDiff(q.lon, p.lon) < 7 && Math.abs(q.r - r) < 12)) r -= 13;
      placed.push({ lon: p.lon, r });
      const [x, y] = P(p.lon, r), [mx, my] = P(p.lon, R2);
      g += `<line x1="${mx}" y1="${my}" x2="${P(p.lon, R2 - 5)[0]}" y2="${P(p.lon, R2 - 5)[1]}" class="wh-mark"/><text x="${x}" y="${y}" class="wh-body">${BODY_KO[p.id].glyph}</text>`;
    }
    if (N.asc) {
      for (const [pt, lab] of [[N.asc, "AC"], [N.mc, "MC"]]) {
        const [x1, y1] = P(pt.lon, R3 - 6), [x2, y2] = P(pt.lon, R1 + 4), [tx, ty] = P(pt.lon, R1 + 13);
        g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wh-axis"/><text x="${tx}" y="${ty}" class="wh-ax">${lab}</text>`;
      }
    }
    return `<svg viewBox="-12 -12 ${S + 24} ${S + 24}" class="wheel-svg" role="img" aria-label="출생 차트 원형 그림">${g}</svg>`;
  }

  /* 타고난 직업·재물·애정·건강운과 올해 흐름 */
  function lifeAreas(N) {
    const first = N.firstHouse, signOfHouse = (h) => (first + h - 1) % 12;
    const inHouse = (h) => N.points.filter((p) => p.house === h && !["uranus", "neptune", "pluto"].includes(p.id));
    const names = (ps) => ps.map((p) => BODY_KO[p.id].ko).join("·");
    const mcSign = N.mc ? N.mc.sign : signOfHouse(10);
    const cTen = inHouse(10), cTwo = inHouse(2), cSeven = inHouse(7), cFive = inHouse(5);
    const V = N.sky.venus, M = N.sky.mars, J = N.sky.jupiter, S = N.sky.saturn;
    // 올해 목성(넓어짐)·토성(다져짐)이 지나는 영역
    const now = Date.now();
    const jH = houseOf(Math.floor(bodyLongitude("jupiter", now) / 30), first), sH = houseOf(Math.floor(bodyLongitude("saturn", now) / 30), first);
    const yr = (area) => {
      const out = [];
      if (YEAR_AREA[jH] === area) out.push(`<b>올해 목성이 ${HOUSE_TOPIC[jH].short} 영역을 지나</b> 이 분야에서 기회가 넓어지는 시기입니다.`);
      if (YEAR_AREA[sH] === area) out.push(`<b>토성이 ${HOUSE_TOPIC[sH].short} 영역을 지나</b> 책임은 무겁지만 이 분야의 기반을 단단히 다지는 시기입니다.`);
      return out.length ? `<p class="la-year">${out.join(" ")}</p>` : "";
    };
    const card = (icon, title, sub, body) => `<section class="la-card"><p class="la-k">${icon} ${title}</p><p class="la-sub">${sub}</p>${body}</section>`;
    const career = card("💼", "직업운", `${N.mc ? "천정점(MC)" : "10번째 하우스"}이 ${signTag(mcSign)}`, `
      <p><b>${CAREER_SIGN[mcSign][0]}</b>에서 가장 빛납니다. ${CAREER_DETAIL[mcSign]}</p>
      <p class="la-fit"><b>어울리는 분야</b> ${CAREER_SIGN[mcSign][1]}</p>
      <p>${rulerLine("직업운", mcSign, N)}</p>
      ${cTen.length ? `<p>일의 자리(10하우스)에 들어 있는 행성:</p><ul class="la-pl">${planetsInArea(cTen)}</ul>` : ""}
      <p>일하는 태도는 토성이 있는 ${SIGNS[S.sign].ko}처럼 <b>${SIGN_PLAIN[S.sign]}</b>으로 결과를 만듭니다. 토성은 시간이 걸려도 결국 인정받는 방식을 알려 주는 행성입니다.</p>
      ${yr("career")}`);
    const money = card("💰", "재물운", `돈의 자리(2하우스)가 ${signTag(signOfHouse(2))}`, `
      <p>${MONEY_SIGN[signOfHouse(2)]} ${MONEY_DETAIL[signOfHouse(2)]}</p>
      <p>${rulerLine("재물운", signOfHouse(2), N)}</p>
      ${cTwo.length ? `<p>돈의 자리(2하우스)에 들어 있는 행성:</p><ul class="la-pl">${planetsInArea(cTwo)}</ul>` : ""}
      <p>행운의 별 목성은 ${HOUSE_TOPIC[J.house].short} 영역에 있어, <b>${HOUSE_TOPIC[J.house].long}</b>을(를) 통해 복이 들어옵니다.</p>
      ${yr("money")}`.replace("을(를)", josa(HOUSE_TOPIC[J.house].long, "을", "를")));
    const love = card("💗", "애정운", `금성 ${signTag(V.sign)} · 화성 ${signTag(M.sign)}`, `
      <p>${LOVE_SIGN[V.sign]} ${LOVE_DETAIL[V.sign]}</p>
      <p class="la-fit"><b>끌리는 사람</b> ${ATTRACT_SIGN[M.sign]}</p>
      <p class="la-fit"><b>인연이 되는 짝</b> ${PARTNER_SIGN[signOfHouse(7)]}${N.asc ? "" : " (태어난 시각을 넣으면 더 정확해집니다)"}</p>
      <p>${rulerLine("결혼과 파트너운", signOfHouse(7), N)}</p>
      ${cSeven.length ? `<p>짝의 자리(7하우스)에 들어 있는 행성:</p><ul class="la-pl">${planetsInArea(cSeven)}</ul>` : ""}
      ${cFive.length ? `<p>연애의 자리(5하우스)에 들어 있는 행성:</p><ul class="la-pl">${planetsInArea(cFive)}</ul>` : ""}
      ${yr("love")}`);
    const health = card("🌿", "건강운", `건강의 자리(6하우스)가 ${signTag(signOfHouse(6))}`, `
      <p class="la-fit"><b>신경 써야 할 곳</b> ${HEALTH_SIGN[signOfHouse(6)]}</p>
      <p>${HEALTH_DETAIL[signOfHouse(6)]}</p>
      ${inHouse(6).length ? `<p>건강의 자리(6하우스)에 들어 있는 행성:</p><ul class="la-pl">${planetsInArea(inHouse(6))}</ul>` : ""}
      <p>에너지는 화성이 있는 ${SIGNS[M.sign].ko}처럼 <b>${SIGN_PLAIN[M.sign]}</b>의 리듬으로 쓸 때 가장 건강합니다.</p>`);
    const Me = N.sky.mercury, nodeSign = N.sky.node.sign, nodeH = houseOf(nodeSign, first);
    const study = card("📚", "학업·시험운", `수성 ${signTag(Me.sign)} · 배움의 자리 ${signTag(signOfHouse(9))}`, `
      <p>${STUDY_SIGN[Me.sign]} ${STUDY_DETAIL[Me.sign]}</p>
      <p>${rulerLine("배움", signOfHouse(9), N)}</p>
      ${inHouse(3).length || inHouse(9).length ? `<p>배움의 자리에 ${josaWord(names([...inHouse(3), ...inHouse(9)]), "이/가")} 있어 공부와 자격증이 삶에 큰 도움이 됩니다.</p>` : ""}
      ${yr("study")}`);
    const social = card("🤝", "대인관계운", `친구의 자리(11하우스)가 ${signTag(signOfHouse(11))}`, `
      <p class="la-fit"><b>인연이 깊은 사람들</b> ${SOCIAL_SIGN[signOfHouse(11)]}</p>
      <p>${SOCIAL_DETAIL[signOfHouse(11)]}</p>
      <p>${rulerLine("대인관계운", signOfHouse(11), N)}</p>
      <p>사람을 대할 때는 달이 있는 ${SIGNS[N.sky.moon.sign].ko}처럼 <b>${SIGN_PLAIN[N.sky.moon.sign]}</b>으로 다가갑니다.</p>
      ${inHouse(11).length ? `<p>친구의 자리에 ${josaWord(names(inHouse(11)), "이/가")} 있어 모임과 인맥이 큰 기회가 됩니다.</p>` : ""}
      ${yr("people")}`);
    const home = card("🏠", "가정운", `집의 자리(4하우스)가 ${signTag(signOfHouse(4))}`, `
      <p class="la-fit"><b>어울리는 가정</b> ${HOME_SIGN[signOfHouse(4)]}</p>
      <p>${HOME_DETAIL[signOfHouse(4)]}</p>
      <p>${rulerLine("가정운", signOfHouse(4), N)}</p>
      <p>마음이 편해지는 조건은 달이 알려 줍니다. <b>${MOON_NEED[N.sky.moon.sign]}</b> 집이 진짜 쉼터가 됩니다.</p>
      ${inHouse(4).length ? `<p>집의 자리에 ${josaWord(names(inHouse(4)), "이/가")} 있어 가족과 집이 인생의 중심에 있습니다.</p>` : ""}
      ${yr("home")}`);
    const travel = card("✈️", "해외·이동운", `먼 길의 자리(9하우스)가 ${signTag(signOfHouse(9))}`, `
      <p>${TRAVEL_SIGN[signOfHouse(9)]}.</p>
      <p>${rulerLine("해외·이동운", signOfHouse(9), N)}</p>
      ${inHouse(9).length ? `<p>먼 길의 자리에 ${josaWord(names(inHouse(9)), "이/가")} 있어 해외 생활이나 유학과 인연이 깊습니다.</p>` : ""}`);
    const talent = card("✨", "타고난 재능", `태양 ${signTag(N.sky.sun.sign)} · 목성 ${signTag(J.sign)}`, `
      <p class="la-fit"><b>가장 큰 무기</b> ${TALENT_SIGN[N.sky.sun.sign]}, 그리고 ${TALENT_SIGN[J.sign]}</p>
      <p>태양은 당신이 가장 자연스럽게 빛나는 방식을 보여 줍니다. ${SIGNS[N.sky.sun.sign].ko} 태양은 <b>${TALENT_DETAIL[N.sky.sun.sign]}</b>${josa(TALENT_DETAIL[N.sky.sun.sign], "을", "를")} 타고났습니다. 목성은 재능이 커지는 방향으로, ${SIGNS[J.sign].ko} 목성은 <b>${TALENT_DETAIL[J.sign]}</b>${josa(TALENT_DETAIL[J.sign], "을", "를")} 쓸수록 운이 함께 커집니다.</p>
      <p>${josaWord(BODY_KO.jupiter.ko, "이/가")} ${HOUSE_TOPIC[J.house].short} 영역(${J.house}하우스)에 있어, 이 재능은 ${HOUSE_VIA[J.house]} 꽃핍니다.</p>
      ${inHouse(5).length ? `<p>재능의 자리(5하우스)에 ${josaWord(names(inHouse(5)), "이/가")} 있어 창작과 표현으로 이름을 알릴 수 있습니다.</p>` : `<p>꾸준히 꺼내 쓸수록 커지는 재능입니다. 취미로 시작해도 좋습니다.</p>`}`);
    const destiny = card("🧭", "인생의 방향", `달의 교점 ${signTag(nodeSign)} · ${HOUSE_TOPIC[nodeH].short} 영역`, `
      <p>${NODE_SIGN[nodeSign]}</p>
      <p>이 과제는 특히 <b>${HOUSE_TOPIC[nodeH].long}</b>의 영역에서 펼쳐집니다. ${HOUSE_FOCUS[nodeH]}</p>
      <p>반대편 남쪽 교점(${SIGNS[(nodeSign + 6) % 12].ko})은 이미 익숙하고 잘하는 것입니다. 그 편안함에만 머물지 말고 북쪽 교점의 방향으로 한 걸음씩 나아갈 때 삶이 깊어진다고 봅니다.</p>
      <p class="muted small">달의 교점은 점성술에서 '이번 생에서 자라야 할 방향'으로 읽는 자리입니다.</p>`);
    const ascSign = N.asc ? N.asc.sign : N.sky.sun.sign, look = LOOK_SIGN[ascSign];
    const lookIn = inHouse(1).filter((p) => LOOK_PLANET[p.id]);
    const appearance = card("✨", "외모·첫인상", `${N.asc ? "상승궁" : "태양 별자리(시각을 넣으면 상승궁으로 더 정확해집니다)"} ${signTag(ascSign)} · 금성 ${signTag(V.sign)}`, `
      <p><b>${look[0]}</b>입니다. ${look[1]}</p>
      <p>${look[2]}</p>
      <p class="la-fit"><b>매력 포인트</b> ${VENUS_STYLE[V.sign]}.</p>
      ${lookIn.length ? `<ul class="la-pl">${lookIn.map((p) => `<li>${LOOK_PLANET[p.id]}.</li>`).join("")}</ul>` : ""}
      <p>달이 ${SIGNS[N.sky.moon.sign].ko}에 있어, 편한 사람 앞에서는 <b>${LOOK_SIGN[N.sky.moon.sign][0]}</b>의 모습이 드러납니다. 처음 보는 사람과 가까운 사람이 느끼는 당신의 얼굴이 조금 다를 수 있습니다.</p>
      <p class="muted small">점성술에서 겉모습은 태어날 때 동쪽 지평선에 떠오르던 별자리(상승궁)로, 매력과 스타일은 금성으로 봅니다.</p>`);
    return `<section class="life-areas">
      <h3 class="pro-h">타고난 운 <small>출생 차트에서 각 분야를 맡은 자리로 읽습니다${N.known ? "" : ". 태어난 시각이 없으면 태양 별자리를 기준으로 어림합니다"}</small></h3>
      <div class="la-grid">${appearance}${career}${money}${love}${health}${study}${social}${home}${travel}${talent}${destiny}</div>
      <p class="muted small">언제 기회가 오는지는 '1년' 탭과 '이번 달' 탭의 날짜를 함께 보세요. 운세는 재미와 자기 성찰을 위한 참고입니다.</p>
    </section>`;
  }

  /* 별자리로 본 스타 — 닮은 스타, 잘 맞는/엇갈리는 스타 (재미로) */
  const GENDER_KEY = "byeolnuri.gender";
  let starCache = null;
  function starCharts() {
    if (!starCache && typeof STAR_PEOPLE !== "undefined") starCache = STAR_PEOPLE.map(([name, g, job, y, m, d, tz]) => ({ name, g, job, y, m, d, N: natalChart({ y, m, d, hh: NaN, mm: 0, tz }) }));
    return starCache || [];
  }
  function starsSection(N) {
    const list = starCharts();
    if (!list.length) return "";
    let gender = ""; try { gender = localStorage.getItem(GENDER_KEY) || ""; } catch (e) {}
    const me = { sun: N.sky.sun.sign, moon: N.sky.moon.sign };
    const ids = [["sun", "태양", 4], ["moon", "달", 3], ["venus", "금성", 1.5], ["mars", "화성", 1], ["mercury", "수성", 1]];
    const scored = list.map((c) => {
      const same = ids.filter(([id]) => c.N.sky[id].sign === N.sky[id].sign);
      let sim = same.reduce((a, [, , w]) => a + w, 0);
      if (SIGNS[c.N.sky.sun.sign].element === SIGNS[N.sky.sun.sign].element) sim += 1;
      if (N.asc && c.N.sky.sun.sign === N.asc.sign) sim += 1.5;
      const fit = renderSynastry(N, c.N, compatibility(me, { sun: c.N.sky.sun.sign, moon: c.N.sky.moon.sign }).total).total;
      return { ...c, same, sim, fit };
    });
    const born = (c) => `${c.y}.${c.m}.${c.d}`;
    const tags = (c) => `태양 ${SIGNS[c.N.sky.sun.sign].ko} · 달 ${SIGNS[c.N.sky.moon.sign].ko}`;
    const alike = [...scored].sort((a, b) => b.sim - a.sim || b.fit - a.fit).slice(0, 3);
    const why = (c) => c.same.length ? `${c.same.map(([, ko]) => ko).join("·")}이 나와 같은 별자리에 있어` : `태양이 나와 같은 ${SIGNS[c.N.sky.sun.sign].element} 기운이라`;
    const pick = (g, best) => [...scored].filter((c) => c.g === g).sort((a, b) => best ? b.fit - a.fit : a.fit - b.fit).slice(0, 2);
    const label = (g) => gender ? (g === gender ? "동성" : "이성") : (g === "m" ? "남자" : "여자");
    const order = gender ? [gender === "m" ? "f" : "m", gender] : ["f", "m"];
    const row = (c, kind) => `<li><span class="st-name">${c.name}</span><span class="st-meta">${c.job} · ${born(c)}</span><span class="st-tags">${tags(c)}</span>${kind ? `<span class="st-score ${kind}">${c.fit}점</span>` : ""}</li>`;
    const box = (title, cls, items, kind) => `<div class="st-box ${cls}"><p class="st-k">${title}</p><ul>${items.map((c) => row(c, kind)).join("")}</ul></div>`;
    return `<section class="stars">
      <h3 class="pro-h">별자리로 본 스타 <small>공개된 생일로 계산한 재미용 비교입니다. 스타의 태어난 시각은 몰라 정오 기준으로 봅니다</small></h3>
      <div class="st-alike"><p class="st-k">🪞 나와 별자리가 닮은 스타</p>
        <ul>${alike.map((c) => `<li><span class="st-name">${c.name}</span><span class="st-meta">${c.job} · ${born(c)}</span><span class="st-tags">${why(c)}, 타고난 분위기와 성향이 닮았습니다</span></li>`).join("")}</ul>
        <p class="muted small">얼굴 생김새가 아니라 출생 차트가 닮은 사람입니다. 같은 별자리 배치는 비슷한 분위기와 매력으로 드러난다고 봅니다.</p></div>
      <div class="st-gender">나는 <button type="button" data-gender="f" class="${gender === "f" ? "on" : ""}">여자</button><button type="button" data-gender="m" class="${gender === "m" ? "on" : ""}">남자</button><button type="button" data-gender="" class="${!gender ? "on" : ""}">선택 안 함</button>
        <span class="muted small">${gender ? "동성·이성으로 나눠 보여 드려요" : "고르면 동성·이성으로 나눠 보여 드려요"}</span></div>
      <div class="st-grid">
        ${order.map((g) => box(`💞 가장 잘 맞는 ${label(g)} 스타`, "is-best", pick(g, true), "good")).join("")}
        ${order.map((g) => box(`⚡ 별자리가 엇갈리는 ${label(g)} 스타`, "is-worst", pick(g, false), "bad")).join("")}
      </div>
      <p class="muted small">점수는 '궁합' 탭과 같은 방식(두 사람의 행성이 이루는 각도)으로 계산했습니다. 엇갈린다는 건 서로 다른 리듬을 가졌다는 뜻일 뿐, 실제 사람에 대한 평가가 아닙니다.</p>
    </section>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".st-gender [data-gender]"); if (!b) return;
    try { localStorage.setItem(GENDER_KEY, b.dataset.gender); } catch (err) {}
    const sec = b.closest(".stars"); if (sec && state.natal) { const tmp = document.createElement("div"); tmp.innerHTML = starsSection(state.natal); sec.replaceWith(tmp.firstElementChild); }
  });

  function renderNatal() {
    const box = $("#chart-result"), N = state.natal;
    if (!N) { box.hidden = true; return; }
    box.hidden = false;
    const b = N.birth;
    const pts = [...N.points, ...(N.asc ? [N.asc, N.mc] : [])];
    const elem = { 불: 0, 흙: 0, 공기: 0, 물: 0 }, mod = { 활동: 0, 고정: 0, 변통: 0 };
    const w = (id) => (["sun", "moon"].includes(id) ? 2 : ["uranus", "neptune", "pluto"].includes(id) ? 0.5 : 1);
    for (const p of N.points) { elem[SIGNS[p.sign].element] += w(p.id); mod[MODALITY[p.sign % 3]] += w(p.id); }
    const tot = Object.values(elem).reduce((a, x) => a + x, 0);
    const aspects = [];
    for (let i = 0; i < N.points.length; i++) for (let j = i + 1; j < N.points.length; j++) {
      const p = N.points[i], q = N.points[j];
      const a = aspectOf(p.lon, q.lon, ["sun", "moon"].includes(p.id) || ["sun", "moon"].includes(q.id) ? 7 : 5);
      if (a) aspects.push({ p, q, a });
    }
    aspects.sort((x, y) => x.a.orb - y.a.orb);
    // 별누리만의 정보: 실제 하늘의 별자리, 생일 별
    const real = realConstellationOfSun(N.ms);
    const age = (Date.now() - N.ms) / (365.25 * 86400000);
    let birthStar = null;
    if (typeof SKY_NAMED !== "undefined") {
      for (const [, i] of SKY_NAMED) { const ly = SKY_STARS[i][4]; if (ly && (!birthStar || Math.abs(ly - age) < Math.abs(birthStar.ly - age)) && SKY_STARS[i][2] < 4.5) birthStar = { i, ly }; }
    }
    state.birthStar = birthStar; state.real = real;
    const placeQ = `&lat=${b.lat}&lon=${b.lon}&place=${encodeURIComponent(b.place || "")}`;
    // ---------- 당신은 이런 사람 (쉬운 말) ----------
    const domEl = Object.entries(elem).sort((x, y) => y[1] - x[1]);
    const lackEl = domEl.filter(([, v]) => v / tot < 0.12).map(([k]) => k);
    const bySign = {}; for (const p of N.points.filter((p) => !["uranus", "neptune", "pluto"].includes(p.id))) (bySign[p.sign] = bySign[p.sign] || []).push(p);
    const stellium = Object.entries(bySign).find(([, ps]) => ps.length >= 3);
    const sunS = N.sky.sun.sign, moonS = N.sky.moon.sign, ascS = N.asc ? N.asc.sign : null;
    const persona = `
      <section class="persona">
        <p class="persona-kicker">별자리로 본 당신</p>
        <h3 class="persona-title">${SIGN_PLAIN[sunS]}을 가진 사람</h3>
        <div class="persona-big3">
          <div><p class="pb-k">겉으로 드러나는 나 · 태양 ${signTag(sunS)}</p><p>${SIGNS[sunS].traits}</p></div>
          <div><p class="pb-k">속마음 · 달 ${signTag(moonS)}</p><p>마음 깊은 곳은 ${SIGN_PLAIN[moonS]}으로 움직입니다. <b>${MOON_NEED[moonS]}</b> 가장 편안해집니다.</p></div>
          <div><p class="pb-k">첫인상 · 상승 ${ascS != null ? signTag(ascS) : "?"}</p><p>${ascS != null ? `처음 만난 사람들은 당신을 <b>${RISING_IN[ascS]}</b>으로 기억합니다.` : "태어난 시각을 넣으면 남들이 보는 첫인상까지 알려 드립니다."}</p></div>
        </div>
        <p class="persona-el"><b>${domEl[0][0]} 기운이 가장 강한 ${ELEMENT_PLAIN[domEl[0][0]].word}</b> — ${ELEMENT_PLAIN[domEl[0][0]].text}${lackEl.length ? ` ${ELEMENT_LACK[lackEl[0]]}` : ""}</p>
        ${stellium ? `<p class="persona-el"><b>${SIGNS[stellium[0]].ko}에 별이 ${stellium[1].length}개 모여 있어요.</b> ${SIGN_PLAIN[stellium[0]]}이(가) 당신 인생의 큰 주제입니다.</p>`.replace("이(가)", josa(SIGN_PLAIN[stellium[0]], "이", "가")) : ""}
        <ul class="persona-list">${["mercury", "venus", "mars", "jupiter", "saturn"].map((id) => { const p = N.sky[id]; return `<li><span class="pl-k">${PERSONA_ROLE[id]}</span><span>${SIGNS[p.sign].ko}처럼 <b>${SIGN_PLAIN[p.sign]}</b>${p.retro && ["mercury", "venus", "mars"].includes(id) ? " (속으로 오래 다듬는 편)" : ""}</span></li>`; }).join("")}</ul>
      </section>
      ${lifeAreas(N)}
      ${starsSection(N)}
      <details class="legend"><summary>차트의 기호는 이렇게 읽어요</summary>
        <dl>
          <div><dt>☉ ☽ ☿ ♀ ♂ …</dt><dd>행성 기호입니다. 태양 ☉ 달 ☽ 수성 ☿ 금성 ♀ 화성 ♂ 목성 ♃ 토성 ♄ 천왕성 ♅ 해왕성 ♆ 명왕성 ♇. 행성마다 맡은 성격(사랑, 의욕, 생각 등)이 있습니다.</dd></div>
          <div><dt>사자자리 22°08′</dt><dd>그 행성이 별자리 안 어디쯤 있었는지입니다. 별자리 하나는 30°이고, 22°면 별자리의 끝 무렵입니다. 해석에는 별자리 이름만 보셔도 충분합니다.</dd></div>
          <div><dt>℞ (역행)</dt><dd>태어날 때 그 행성이 지구에서 보기에 거꾸로 가는 것처럼 보였다는 뜻입니다. 점성술에서는 그 힘이 밖보다 안으로 향해, 천천히 오래 다듬어진다고 봅니다. 나쁜 뜻은 아닙니다.</dd></div>
          <div><dt>공부와 여행 <small>9</small></dt><dd>하우스: 삶을 12개 영역(나 자신, 돈, 대화, 집, 연애, 일상, 파트너…)으로 나눈 것입니다. 그 행성의 힘이 삶의 어느 부분에서 주로 쓰이는지 알려 줍니다.</dd></div>
          <div><dt>AC · MC</dt><dd>AC(상승점)는 태어난 순간 동쪽 지평선에 떠오르던 별자리로 첫인상을, MC(천정점)는 머리 위 별자리로 일과 사회적 목표를 봅니다. 정확한 태어난 시각이 있어야 계산됩니다.</dd></div>
          <div><dt>원 안의 선</dt><dd>행성끼리 이루는 각도입니다. <span style="color:#7FA8FF">파란 선</span>은 서로 돕는 조화, <span style="color:#FF7A6A">붉은 선</span>은 긴장과 자극입니다.</dd></div>
          <div><dt>△ □ ☍ ⚹ ☌</dt><dd>각도 기호입니다. △ 120°·⚹ 60°는 조화, □ 90°·☍ 180°는 긴장, ☌ 0°는 두 힘이 하나로 합쳐짐을 뜻합니다.</dd></div>
        </dl>
      </details>`;
    box.innerHTML = `
      <p class="chart-who">${b.y}년 ${b.m}월 ${b.d}일${N.known ? ` ${b.hh}시 ${b.mm}분` : " (시각 모름: 정오 기준, 상승궁·하우스는 태양 기준)"}, ${esc(b.place || "")}</p>
      ${persona}
      <details class="natal-more"><summary>출생 차트 자세히 보기</summary>
      <div class="natal-top">
        ${wheelSVG(N)}
        <div class="natal-side">
          <div class="chart-tiles">
            <div class="chart-tile"><p class="chart-tile-title">태양궁 · 나의 성격</p><p class="chart-tile-sign">${signTag(N.sky.sun.sign)}</p><p class="chart-tile-sub">${SIGNS[N.sky.sun.sign].keyword}</p></div>
            <div class="chart-tile"><p class="chart-tile-title">달궁 · 나의 감정</p><p class="chart-tile-sign">${signTag(N.sky.moon.sign)}</p><p class="chart-tile-sub">${MOON_IN[N.sky.moon.sign]}</p></div>
            <div class="chart-tile"><p class="chart-tile-title">상승궁 · 남이 보는 나</p><p class="chart-tile-sign">${N.asc ? signTag(N.asc.sign) : "모름"}</p><p class="chart-tile-sub">${N.asc ? RISING_IN[N.asc.sign] : "태어난 시각을 넣으면 계산합니다"}</p></div>
          </div>
          <div class="balance">
            <p class="small muted">원소 균형</p>${Object.entries(elem).map(([k, v]) => meter(k, Math.round((v / tot) * 100))).join("")}
            <p class="small muted">양식 · ${Object.entries(mod).sort((a, c) => c[1] - a[1])[0][0]} 성향이 가장 강합니다 (활동 = 시작, 고정 = 지속, 변통 = 적응)</p>
          </div>
        </div>
      </div>
      <div class="table-wrap"><table class="sky-table"><thead><tr><th>천체</th><th>별자리와 도수</th><th>하우스</th></tr></thead><tbody>
        ${pts.map((p) => `<tr><th scope="row"><span class="pg">${BODY_KO[p.id].glyph}</span> ${BODY_KO[p.id].ko}</th><td>${signTag(p.sign)} <span class="dg">${deg(p.lon)}</span>${p.retro ? ' <span class="rx">℞</span>' : ""}</td><td>${p.house ? houseTag(p.house) : "-"}</td></tr>`).join("")}
      </tbody></table></div>
      <h4 class="pro-h4">행성별 해설 <small class="muted">점성가가 읽는 방식</small></h4>
      <ul class="natal-list">${N.points.map((p) => `<li><b>${BODY_KO[p.id].glyph} ${BODY_KO[p.id].ko} · ${SIGNS[p.sign].ko}${p.retro ? " ℞" : ""}</b><br>${natalSentence(p)}</li>`).join("")}</ul>
      <h4 class="pro-h4">주요 각도</h4>
      <ul class="ev-list">${aspects.slice(0, 8).map(({ p, q, a }) => `<li><span class="ev-ic">${BODY_KO[p.id].glyph}${a.sym}${BODY_KO[q.id].glyph}</span><b>${BODY_KO[p.id].ko} ${a.ko} ${BODY_KO[q.id].ko}</b> <span class="muted small">orb ${a.orb.toFixed(1)}°</span><br><span class="small">${josaWord(BODY_KO[p.id].area, "과/와")} ${josaWord(BODY_KO[q.id].area, "이/가")} ${a.nature === "soft" ? "타고난 재능처럼 자연스럽게 함께 움직입니다. 힘들이지 않고 쓰는 강점이니, 의식적으로 꺼내 쓸수록 빛납니다" : a.nature === "hard" ? "서로 긴장을 주고받습니다. 평생 다듬어 가는 숙제이지만, 바로 이 긴장이 당신을 움직이는 원동력이 됩니다" : "하나로 녹아 강하게 드러납니다. 차트에서 가장 눈에 띄는 개성 중 하나입니다"}.</span></li>`).join("")}</ul>
      </details>
      <section class="unique">
        <h4 class="pro-h4">별누리에서만 보는 내 하늘</h4>
        <p>${real === SIGNS[N.sky.sun.sign].ko
          ? `태어난 순간 태양은 점성술로도, 실제 하늘에서도 <b>${real}</b> 앞에 있었습니다. 지구 자전축이 2천 년 동안 돌아(세차) 두 기준은 보통 약 24° 어긋나 있는데, 그 차이를 넘어 두 기준이 겹치는 날에 태어났습니다.`
          : `태어난 순간 태양은 점성술로는 <b>${SIGNS[N.sky.sun.sign].ko}</b>였지만, 실제 하늘에서는 <b>${real}</b> 앞에 있었습니다. 지구 자전축이 2천 년 동안 조금씩 돌아(세차) 두 기준이 약 24° 어긋났기 때문입니다.${real === "뱀주인자리" ? " 태양이 지나지만 점성술 12궁에는 없는 13번째 별자리입니다." : ""}`}</p>
        ${birthStar ? `<p>지금 당신 눈에 닿는 <b>${esc(starInfo(birthStar.i).name)}</b>(${birthStar.ly}광년)의 빛은 대략 당신이 태어날 무렵 그 별을 떠났습니다. 당신의 <b>생일 별</b>입니다.</p>` : ""}
        <div class="unique-actions">
          <a class="btn btn-ink" href="${skyLink(N.ms, placeQ + "&view=look")}">태어난 순간의 밤하늘 보기</a>
          ${birthStar ? `<a class="btn btn-line" href="index.html?s=${birthStar.i}">생일 별 찾아가기</a>` : ""}
          <button type="button" class="btn btn-star share-btn" data-share="chart">내 차트 카드 공유</button>
        </div>
      </section>
      <button type="button" class="link-btn" id="chart-clear">별 지도 지우기</button>`;
  }

  /* ---------- 4. 시너스트리 궁합 ---------- */
  function renderSynastry(A, B, baseCompat) {
    const list = synastry(A, B);
    const groups = { attraction: [], talk: [], comfort: [], commit: [], growth: [] };
    const pairW = (s) => (["sun", "moon", "venus", "mars", "asc"].includes(s.a) ? 1.2 : 1) * (["sun", "moon", "venus", "mars", "asc"].includes(s.b) ? 1.2 : 1);
    for (const s of list) {
      const t = synastryText(s);
      const maxOrb = ["sun", "moon"].includes(s.a) || ["sun", "moon"].includes(s.b) ? 8 : 6;
      const val = (1 - s.orb / maxOrb) * pairW(s) * (t.hard ? (SYN_GROUP(s) === "attraction" ? 0.4 : -0.7) : 1);
      groups[SYN_GROUP(s)].push({ ...s, t, val });
    }
    const gScore = (g) => Math.max(25, Math.min(98, Math.round(62 + groups[g].reduce((a, x) => a + x.val, 0) * 14)));
    const gs = Object.keys(groups).map((g) => [g, gScore(g)]);
    const total = Math.round(baseCompat * 0.35 + (gs.reduce((a, [, v]) => a + v, 0) / gs.length) * 0.65);
    const top = list.slice(0, 8).map((s) => ({ ...s, t: synastryText(s) }));
    return { total, html: `
      <div class="meters">${gs.map(([g, v]) => meter(SYN_GROUP_KO[g], v)).join("")}</div>
      <h4 class="pro-h4">두 사람의 하늘이 만나는 곳</h4>
      <ul class="ev-list">${top.map((s) => `<li class="${s.t.hard ? "is-hard" : "is-soft"}"><span class="ev-ic">${BODY_KO[s.a].glyph}${s.aspect.sym}${BODY_KO[s.b].glyph}</span><b>나의 ${BODY_KO[s.a].ko} ${s.aspect.ko} 상대의 ${BODY_KO[s.b].ko}</b> <span class="muted small">orb ${s.orb.toFixed(1)}°</span><br><span class="small">${s.t.text}</span></li>`).join("") || "<li class='muted'>가까운 각도가 없습니다. 서로 독립적인 관계입니다.</li>"}</ul>` };
  }

  /* ---------- 공유 카드 ---------- */
  async function shareToday() {
    const ms = Date.now() + state.offset * 86400000, sky = skyAt(ms), sign = state.sign;
    const date = new Date(ms);
    const moon = moonPosition(ms);
    const retro = BODIES.filter((id) => sky[id].retro && ["mercury", "venus", "mars"].includes(id)).map((id) => `${BODY_KO[id].ko} 역행`);
    const skyLine = `오늘 달은 ${SIGNS[sky.moon.sign].ko}, ${moonPhaseName(moon)}. ${retro.length ? retro.join(", ") + " 중." : ""}`;
    let headlineKicker, headline, body, doList, dontList, basisLabel;
    const N = state.natal;
    const list = N ? transitsNow(ms, N).filter((t) => t.transit !== "moon" || true) : [];
    if (N && list.length) {
      const pick = list.find((t) => transitCategory(t) === "power" && t.transit !== "moon") || list.find((t) => t.transit !== "moon") || list[0];
      const pl = plainTransit(pick), tone = PLAIN_TONE[transitCategory(pick)];
      headlineKicker = `오늘의 별 · ${tone.ko}`;
      headline = pl.title;
      body = `${pl.text} ${pl.tip}`;
      const groups = { power: [], other: [] };
      for (const t of list) (transitCategory(t) === "power" ? groups.power : groups.other).push(t);
      doList = [...new Set(groups.power.map((t) => TRANSIT_DO[t.transit][0]))].slice(0, 3);
      dontList = [...new Set(groups.other.map((t) => TRANSIT_DO[t.transit][1]))].slice(0, 3);
      basisLabel = "내 출생 차트로 읽은 오늘";
    } else {
      const f = makeFortune(sign, date, null);
      headlineKicker = `오늘의 총운 ${"★".repeat(f.categories[0].score)}${"☆".repeat(5 - f.categories[0].score)}`;
      headline = `달이 ${SIGNS[sign].ko}와 ${f.aspect.name}`;
      body = `${f.aspect.text} ${f.categories[0].text}`;
      doList = [f.mission]; dontList = [f.avoid];
      basisLabel = "오늘의 별자리 운세";
    }
    if (!doList.length) doList = ["평소 리듬대로 지내기"];
    if (!dontList.length) dontList = ["무리한 일정 잡기"];
    const cv = await ShareCard.today({
      seed: hashString(`${fmtDay(ms)}:${sign}`), dateLabel: fmtDay(ms), sign, basisLabel, skyLine,
      headlineKicker, headline, body, doList, dontList,
      points: BODIES.map((id) => sky[id]),
      ringCaption: "오늘 하늘의 행성 배치입니다. 파란 선은 조화, 붉은 선은 긴장의 각도입니다.",
    });
    ShareCard.preview(cv, `byeolnuri-${SIGNS[sign].id}.png`, `${SIGNS[sign].ko} · ${fmtDay(ms)}`);
  }
  async function shareChart() {
    const N = state.natal;
    if (!N) return;
    const b = N.birth;
    const line = `${SIGNS[N.sky.sun.sign].keyword}을 지닌 ${SIGNS[N.sky.sun.sign].ko}, 마음은 ${MOON_IN[N.sky.moon.sign]}.${N.asc ? ` 사람들은 나를 ${RISING_IN[N.asc.sign]}으로 기억합니다.` : ""}`;
    const cv = await ShareCard.chart({
      seed: hashString(`${b.y}-${b.m}-${b.d}`), whoLabel: `${b.y}년 ${b.m}월 ${b.d}일${N.known ? ` ${b.hh}시 ${String(b.mm).padStart(2, "0")}분` : ""} · ${b.place || ""}`,
      points: N.points, ascLon: N.asc ? N.asc.lon : null,
      sun: N.sky.sun.sign, moon: N.sky.moon.sign, rising: N.asc ? N.asc.sign : null,
      line, footLine: state.birthStar ? `생일 별 · ${starInfo(state.birthStar.i).name}` : `실제 하늘의 태양 · ${state.real || ""}`,
    });
    ShareCard.preview(cv, "byeolnuri-chart.png", "나의 출생 차트");
  }

  /* ---------- 탭 ---------- */
  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".pro-tab").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
    document.querySelectorAll(".pro-panel").forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    renderTab();
  }
  function renderTab() {
    const t = state.tab;
    try {
      if (t === "today") { const ms = Date.now() + state.offset * 86400000; renderSkyNow(ms); renderTransits(ms); }
      if (t === "week") renderWeek();
      if (t === "month") renderMonth();
      if (t === "year") renderYear();
      if (t === "chart") renderNatal();
    } catch (err) { console.error(err); }
  }

  function update({ sign, profile, offset }) {
    if (sign != null) state.sign = sign;
    if (offset != null) state.offset = offset;
    if (profile !== undefined) { state.profile = profile; state.natal = natalOf(profile); try { renderHero(); } catch (err) { console.error(err); } }
    renderTab();
  }

  function init() {
    document.querySelectorAll(".pro-tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
    document.querySelector(".pro-tabs")?.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tabs = [...document.querySelectorAll(".pro-tab")], i = tabs.findIndex((b) => b.dataset.tab === state.tab);
      const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      setTab(n.dataset.tab); n.focus();
    });
    document.addEventListener("click", (e) => {
      const sh = e.target.closest("[data-share]");
      if (sh) { (sh.dataset.share === "chart" ? shareChart() : shareToday()).catch((err) => console.error(err)); }
    });
    document.addEventListener("click", (e) => { const g = e.target.closest("[data-go-tab]"); if (g) { setTab(g.dataset.goTab); $(".pro-tabs").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  }

  return { init, update, setTab, renderSynastry, natalOf, personalMods, get natal() { return state.natal; } };
})();
