/* 용어 풀이 — 운세 화면의 어려운 말(하우스, 각도 이름, 역행 등)을 누르면 짧은 설명이 뜬다 */
(function () {
  const HOUSE_MEAN = [null,
    "나 자신의 자리. 성격, 첫인상, 외모, 새 출발을 봅니다.",
    "돈과 소유의 자리. 버는 방식, 쓰는 습관, 자존감을 봅니다.",
    "대화와 배움의 자리. 말과 글, 형제, 가까운 이동을 봅니다.",
    "집과 뿌리의 자리. 가족, 고향, 마음이 쉬는 곳을 봅니다.",
    "연애와 즐거움의 자리. 사랑, 취미, 창작, 자녀를 봅니다.",
    "일상과 건강의 자리. 매일의 일, 습관, 몸 관리를 봅니다.",
    "파트너의 자리. 결혼, 동업, 1:1 관계를 봅니다.",
    "깊은 유대의 자리. 공동의 돈, 상속, 변화와 재생을 봅니다.",
    "먼 길의 자리. 해외, 여행, 고등 학문, 신념을 봅니다.",
    "직업과 명예의 자리. 커리어, 사회적 지위, 목표를 봅니다.",
    "친구와 꿈의 자리. 모임, 인맥, 미래의 희망을 봅니다.",
    "숨은 자리. 휴식, 무의식, 혼자만의 시간, 정리를 봅니다."];
  const T = {
    house: { t: "하우스", d: "태어난 순간의 하늘을 12칸으로 나눈 것으로, 칸마다 삶의 한 분야를 맡습니다. 별자리가 ‘어떻게’(성향)라면 하우스는 ‘어디서’(분야)입니다. 행성이 어느 칸에 있느냐에 따라 그 힘이 어느 분야에서 쓰이는지 정해집니다. 칸의 경계는 태어난 시각으로 정해져서, 시각을 모르면 대략적으로만 나옵니다." },
    conj: { t: "합 (0°)", s: "☌", d: "두 행성이 하늘에서 거의 같은 자리에 붙어 있는 상태입니다. 두 힘이 하나로 섞여 강하게 드러납니다. 좋고 나쁨은 어떤 행성끼리 만났는지에 따라 달라집니다." },
    sextile: { t: "섹스타일 (60°)", s: "⚹", d: "두 행성이 60도 떨어져 있습니다. 가볍게 서로 돕는 관계로, 기회가 찾아오지만 내가 손을 뻗어 잡아야 살아납니다." },
    square: { t: "스퀘어 (90°)", s: "□", d: "두 행성이 90도로 엇갈려 있습니다. 서로 부딪혀 긴장과 스트레스를 만들지만, 그 압박이 나를 움직이고 성장시키는 원동력이 됩니다." },
    trine: { t: "트라인 (120°)", s: "△", d: "두 행성이 120도로 조화롭게 놓였습니다. 가장 순한 각도로, 타고난 재능처럼 힘들이지 않고 술술 풀립니다. 너무 편해서 그냥 지나치지 않도록 의식적으로 꺼내 쓰면 좋습니다." },
    opp: { t: "대립 (180°)", s: "☍", d: "두 행성이 하늘 정반대에서 마주 봅니다(오포지션). 양쪽을 오가는 줄다리기로, 균형을 맞춰야 합니다. 다른 사람과의 관계에서 드러나는 일이 많습니다." },
    aspect: { t: "각도 (애스펙트)", d: "두 행성이 하늘에서 몇 도 떨어져 있는지를 봅니다. 0°(합), 60°(섹스타일), 90°(스퀘어), 120°(트라인), 180°(대립)가 대표적이고, 각도에 따라 두 힘이 서로 돕는지 부딪히는지를 읽습니다." },
    orb: { t: "orb (오브)", d: "정확한 각도에서 얼마나 벗어나 있는지를 뜻합니다. 숫자가 작을수록 각도가 정확해서 영향이 강하게 느껴집니다. 보통 5~7° 안쪽을 의미 있게 봅니다." },
    retro: { t: "역행 (℞)", s: "℞", d: "지구에서 볼 때 행성이 잠시 거꾸로 가는 것처럼 보이는 현상입니다. 실제로 뒤로 가지는 않습니다. 그 행성이 맡은 일은 새로 벌이기보다 다시 살피고 고치기에 좋은 시기로 봅니다." },
    asc: { t: "상승궁 (ASC)", d: "태어난 순간 동쪽 지평선에 떠오르던 별자리입니다. 남에게 보이는 첫인상과 겉모습, 세상을 대하는 태도를 나타내고, 1하우스의 시작점이 됩니다. 정확한 출생 시각이 있어야 알 수 있습니다." },
    mc: { t: "천정점 (MC)", d: "태어난 순간 하늘 가장 높은 곳에 있던 지점입니다. 사회에서 이루고 싶은 목표, 직업과 명예의 방향을 나타냅니다." },
    transit: { t: "트랜짓", d: "지금 하늘을 움직이는 행성이 내가 태어날 때의 행성 자리와 각도를 이루는 것입니다. 그날그날, 그해의 운세 흐름을 읽는 핵심입니다." },
    void: { t: "보이드 (공허한 달)", d: "달이 다음 별자리로 넘어가기 전, 다른 행성과 더 이상 각도를 맺지 않는 시간입니다. 새로 시작한 일이 흐지부지되기 쉽다고 보아, 중요한 결정이나 계약은 피하고 정리·휴식에 쓰기 좋습니다." },
    ruler: { t: "주인 행성", d: "별자리마다 그 별자리를 다스리는 행성이 있습니다(양자리는 화성, 황소자리는 금성 등). 어떤 분야를 맡은 별자리의 주인 행성이 차트 어디에 있는지를 보면, 그 분야의 운이 어떤 길로 풀리는지 알 수 있습니다." },
  };
  const RX = /(\d{1,2})하우스|0° 합|60° 섹스타일|섹스타일|90° 스퀘어|스퀘어|120° 트라인|트라인|180° 대립|오포지션|orb [\d.]+°|역행|상승궁(?:\(ASC\))?|천정점(?:\(MC\))?|트랜짓|보이드|주인 행성|애스펙트/g;
  function keyOf(m, n) {
    if (n) return "h" + n;
    if (m.includes("합")) return "conj";
    if (m.includes("섹스타일")) return "sextile";
    if (m.includes("스퀘어")) return "square";
    if (m.includes("트라인")) return "trine";
    if (m.includes("대립") || m.includes("오포지션")) return "opp";
    if (m.startsWith("orb")) return "orb";
    if (m === "역행") return "retro";
    if (m.startsWith("상승궁")) return "asc";
    if (m.startsWith("천정점")) return "mc";
    if (m === "트랜짓") return "transit";
    if (m === "보이드") return "void";
    if (m === "주인 행성") return "ruler";
    return "aspect";
  }
  const SKIP = "script,style,select,option,textarea,input,button,svg,.term,.term-pop,.hs,canvas,title";
  function link(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!RX.test(n.data) ? NodeFilter.FILTER_REJECT : (RX.lastIndex = 0, n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    for (let n; (n = w.nextNode());) nodes.push(n);
    for (const n of nodes) {
      RX.lastIndex = 0;
      const s = n.data, frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = RX.exec(s))) {
        if (m.index > last) frag.append(s.slice(last, m.index));
        const b = document.createElement("button");
        b.type = "button"; b.className = "term"; b.dataset.term = keyOf(m[0], m[1]); b.textContent = m[0];
        frag.append(b); last = m.index + m[0].length;
      }
      if (last < s.length) frag.append(s.slice(last));
      n.replaceWith(frag);
    }
    RX.lastIndex = 0;
  }
  function entry(k) {
    if (k[0] === "h") { const n = +k.slice(1); if (n >= 1 && n <= 12) return { t: `${n}하우스`, d: HOUSE_MEAN[n], more: T.house.d }; }
    const e = T[k]; if (!e) return null;
    return { t: e.t, s: e.s, d: e.d, more: ["conj", "sextile", "square", "trine", "opp"].includes(k) ? T.aspect.d : "" };
  }
  /* 목록 왼쪽 기호 묶음(☉□♃, ●, ♂℞ …) 풀이 */
  const SYM = {
    "●": ["새달", "달이 보이지 않는 날. 새로 시작하고 바라는 것을 심기 좋은 때입니다."],
    "○": ["보름달", "달이 가득 찬 날. 일이 정점에 이르고 결과와 감정이 드러납니다."],
    "◐": ["일식", "새달보다 강한 출발점. 예고 없이 문이 열리고 닫힐 수 있습니다."],
    "◑": ["월식", "보름보다 강한 매듭. 오래 끌어온 일이 드러나거나 정리됩니다."],
    "℞": ["역행", T.retro.d],
    "D": ["순행", "역행을 마치고 다시 앞으로 가기 시작한다는 뜻입니다."],
    "✦": ["좋은 흐름", "힘이 실리는 흐름입니다. 적극적으로 써 보세요."],
    "◆": ["부딪히는 흐름", "긴장이 있지만 잘 쓰면 성장의 계기가 됩니다."],
    "▲": ["조심할 흐름", "서두르지 말고 한 번 더 확인하면 좋은 흐름입니다."],
  };
  function symbolParts(str) {
    const B = typeof BODY_KO !== "undefined" ? BODY_KO : {};
    const A = typeof ASPECT_DEFS !== "undefined" ? ASPECT_DEFS : [];
    const toks = [];
    for (const [id, b] of Object.entries(B)) toks.push({ g: b.glyph, kind: "body", id, b });
    for (const a of A) toks.push({ g: a.sym, kind: "asp", a });
    for (const g of Object.keys(SYM)) toks.push({ g, kind: "sym" });
    toks.sort((x, y) => y.g.length - x.g.length);
    const out = []; let i = 0; const s = str.replace(/\uFE0E|\uFE0F/g, "").trim();
    while (i < s.length) {
      const t = toks.find((k) => s.startsWith(k.g, i));
      if (!t) { i++; continue; }
      out.push(t); i += t.g.length;
    }
    return out;
  }
  function showSymbols(el) {
    const parts = symbolParts(el.textContent);
    if (!parts.length) return;
    const rows = parts.map((t) => {
      if (t.kind === "body") return `<li><span class="term-s">${t.g}</span><b>${t.b.ko}</b> — ${t.b.role || t.b.area}</li>`;
      if (t.kind === "asp") { const e = T[t.a.key]; return `<li><span class="term-s">${t.g}</span><b>${e.t}</b> — ${e.d}</li>`; }
      const [k, d] = SYM[t.g]; return `<li><span class="term-s">${t.g}</span><b>${k}</b> — ${d}</li>`;
    }).join("");
    const isAsp = parts.some((t) => t.kind === "asp") && parts.filter((t) => t.kind === "body").length === 2;
    openPop(`<p class="term-t">${parts.map((t) => t.g).join(" ")}</p><ul class="term-list">${rows}</ul>${isAsp ? `<p class="term-more">왼쪽 행성과 오른쪽 행성이 가운데 기호의 각도로 만난다는 뜻입니다.</p>` : ""}`, el);
  }
  let pop;
  function show(k, from) {
    const e = entry(k); if (!e) return;
    openPop(`<p class="term-t">${e.s ? `<span class="term-s">${e.s}</span>` : ""}${e.t}</p><p>${e.d}</p>${e.more ? `<p class="term-more">${e.more}</p>` : ""}`, from);
  }
  function openPop(html, from) {
    if (!pop) {
      pop = document.createElement("div"); pop.className = "term-pop"; pop.setAttribute("role", "dialog");
      document.body.append(pop);
    }
    pop.innerHTML = `<button type="button" class="term-x" aria-label="닫기">×</button>${html}`;
    pop.hidden = false; pop.classList.add("on");
    document.querySelectorAll(".term.on").forEach((x) => x.classList.remove("on"));
    from && from.classList.add("on");
  }
  function hide() { if (pop) { pop.classList.remove("on"); pop.hidden = true; } document.querySelectorAll(".term.on").forEach((x) => x.classList.remove("on")); }
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest(".term");
    if (t) { ev.preventDefault(); ev.stopPropagation(); return show(t.dataset.term, t); }
    const hs = ev.target.closest(".hs");
    if (hs) { const n = hs.querySelector("small"); if (n) return show("h" + n.textContent.trim(), hs); }
    const ic = ev.target.closest(".ev-ic");
    if (ic) { ev.preventDefault(); return showSymbols(ic); }
    const rx = ev.target.closest(".rx");
    if (rx) return show("retro", rx);
    if (pop && !pop.hidden && (ev.target.closest(".term-x") || !ev.target.closest(".term-pop"))) hide();
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  function start() {
    const root = document.querySelector("main"); if (!root) return;
    link(root);
    let q = 0;
    new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; link(root); }); }).observe(root, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.Glossary = { link, show, hide };
})();
