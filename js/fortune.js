/* 날짜 + 별자리로 시드를 만들어, 같은 날 같은 별자리는 언제 열어도 같은 운세가 나오게 한다.
 * 여기에 그날 실제 달의 위치와 위상, (있으면) 내 별 지도의 달궁을 섞는다. */
function hashString(str) {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const clampScore = (v) => Math.min(5, Math.max(1, Math.round(v)));
const tierOf = (s) => (s >= 4 ? "high" : s === 3 ? "mid" : "low");

/* 하루의 점수만 (7일 흐름에 쓴다) */
function dayScores(signIndex, date, profile) {
  const sign = SIGNS[signIndex];
  const rand = mulberry32(hashString(`${dateKey(date)}:${sign.id}`));
  const score = () => 1 + Math.floor(((rand() + rand()) / 2) * 5);
  const sky = skyOfDay(date);
  const asp = aspectBetween(signIndex, sky.moonSign);
  // 내 달궁과 오늘 달의 관계는 감정(애정운)에 영향을 준다
  const moonAsp = profile ? aspectBetween(profile.moon, sky.moonSign) : null;
  const love = clampScore(score() + asp.love + (moonAsp ? moonAsp.mod * 0.6 : 0));
  const money = clampScore(score() + asp.mod * 0.5);
  const health = clampScore(score() + (sky.phase.startsWith("보름") ? -0.4 : 0));
  const work = clampScore(score() + asp.mod);
  const overall = clampScore((love + money + health + work) / 4 + asp.mod * 0.5 + (rand() - 0.5));
  return { rand, sky, asp, moonAsp, love, money, health, work, overall };
}

function makeFortune(signIndex, date, profile) {
  const sign = SIGNS[signIndex];
  const s = dayScores(signIndex, date, profile);
  const rand = s.rand;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const pickN = (arr, n) => { const a = [...arr], out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(rand() * a.length), 1)[0]); return out; };
  const matches = SIGNS.filter((x, i) => i !== signIndex && ELEMENT_MATCH[sign.element].includes(x.element));

  // 시간대별 흐름: 총운을 중심으로 흔들리되, 위상에 따라 밤이나 아침이 강해진다
  const nightBias = s.sky.phase.includes("보름") || s.sky.phase.includes("차오르") ? 0.6 : 0;
  const morningBias = s.sky.phase.includes("초승") || s.sky.phase.startsWith("삭") ? 0.6 : 0;
  const slots = [
    { label: "아침", score: clampScore(s.overall + (rand() - 0.5) * 3.4 + morningBias) },
    { label: "낮", score: clampScore(s.overall + (rand() - 0.5) * 3.4) },
    { label: "저녁", score: clampScore(s.overall + (rand() - 0.5) * 3.4) },
    { label: "밤", score: clampScore(s.overall + (rand() - 0.5) * 3.4 + nightBias) },
  ];
  const top = Math.max(...slots.map((x) => x.score));
  const tops = slots.filter((x) => x.score === top);
  const best = tops.length === 1 ? tops[0] : null; // 동점이면 '가장 좋은 때'를 정하지 않는다

  // 앞뒤 사흘 흐름
  const week = [-3, -2, -1, 0, 1, 2, 3].map((off) => {
    const d = new Date(date); d.setDate(date.getDate() + off);
    return { off, date: d, score: off === 0 ? s.overall : dayScores(signIndex, d, profile).overall };
  });

  const birthdaySeason = s.sky.sunSign === signIndex;

  return {
    bestLabel: best ? best.label : tops.map((x) => x.label).join(", "),
    sign, sky: s.sky, aspect: s.asp, moonAspect: s.moonAsp, birthdaySeason,
    categories: [
      { key: "overall", label: "총운", score: s.overall, text: pick(FORTUNE_TEXT.overall[tierOf(s.overall)]) },
      { key: "love", label: "애정운", score: s.love, text: pick(FORTUNE_TEXT.love[tierOf(s.love)]) },
      { key: "money", label: "금전운", score: s.money, text: pick(FORTUNE_TEXT.money[tierOf(s.money)]) },
      { key: "work", label: "일과 공부", score: s.work, text: pick(FORTUNE_TEXT.work[tierOf(s.work)]) },
      { key: "health", label: "건강운", score: s.health, text: pick(FORTUNE_TEXT.health[tierOf(s.health)]) },
    ],
    keywords: pickN(KEYWORDS[sign.element], 3),
    advice: pick(ELEMENT_ADVICE[sign.element]),
    mission: pick(MISSIONS),
    avoid: pick(AVOID),
    slots, best, week,
    lucky: {
      color: pick(LUCKY.colors),
      number: 1 + Math.floor(rand() * 45),
      direction: pick(LUCKY.directions),
      item: pick(LUCKY.items),
      match: pick(matches),
    },
  };
}

/* 별 카드: 날짜와 별자리로 세 장의 순서를 정한다 */
function starCardsFor(signIndex, date) {
  const rand = mulberry32(hashString(`${dateKey(date)}:cards:${SIGNS[signIndex].id}`));
  const pool = [...STAR_CARDS];
  return [0, 1, 2].map(() => pool.splice(Math.floor(rand() * pool.length), 1)[0]);
}
