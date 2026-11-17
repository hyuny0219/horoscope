/* 날짜 + 별자리로 시드를 만들어, 같은 날 같은 별자리는 언제 열어도 같은 운세가 나오게 한다. */
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

function makeFortune(signIndex, date) {
  const sign = SIGNS[signIndex];
  const rand = mulberry32(hashString(`${dateKey(date)}:${sign.id}`));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  // 두 난수의 평균을 쓰면 3점 근처가 가장 흔하고 1점·5점은 드물다
  const score = () => 1 + Math.floor(((rand() + rand()) / 2) * 5);
  const tier = (s) => (s >= 4 ? "high" : s === 3 ? "mid" : "low");

  const love = score(), money = score(), health = score();
  const overall = Math.min(5, Math.max(1, Math.round((love + money + health) / 3 + (rand() - 0.5))));

  const matches = SIGNS.filter((s, i) => i !== signIndex && ELEMENT_MATCH[sign.element].includes(s.element));

  return {
    sign,
    categories: [
      { key: "overall", label: "총운", score: overall, text: pick(FORTUNE_TEXT.overall[tier(overall)]) },
      { key: "love", label: "애정운", score: love, text: pick(FORTUNE_TEXT.love[tier(love)]) },
      { key: "money", label: "금전운", score: money, text: pick(FORTUNE_TEXT.money[tier(money)]) },
      { key: "health", label: "건강운", score: health, text: pick(FORTUNE_TEXT.health[tier(health)]) },
    ],
    advice: pick(ELEMENT_ADVICE[sign.element]),
    lucky: {
      color: pick(LUCKY.colors),
      number: 1 + Math.floor(rand() * 45),
      direction: pick(LUCKY.directions),
      time: pick(LUCKY.times),
      item: pick(LUCKY.items),
      match: pick(matches),
    },
  };
}
