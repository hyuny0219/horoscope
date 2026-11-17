/* 전문 운세에 쓰는 해설 문장. 천체 × 각도 × 영역(하우스)을 조합해 문장을 만든다. */

const BODY_KO = {
  sun: { ko: "태양", glyph: "☉", area: "자신감과 존재감", role: "내가 누구인지, 삶의 중심 의지" },
  moon: { ko: "달", glyph: "☽", area: "감정과 마음의 안정", role: "감정, 습관, 편안함을 느끼는 방식" },
  mercury: { ko: "수성", glyph: "☿", area: "생각과 말, 연락", role: "생각하고 말하고 배우는 방식" },
  venus: { ko: "금성", glyph: "♀", area: "사랑과 즐거움, 돈", role: "사랑하는 방식, 취향, 돈과 가치" },
  mars: { ko: "화성", glyph: "♂", area: "의욕과 행동력", role: "원하는 것을 쫓는 힘, 경쟁, 화" },
  jupiter: { ko: "목성", glyph: "♃", area: "성장과 기회", role: "운이 넓어지는 곳, 믿음, 배움" },
  saturn: { ko: "토성", glyph: "♄", area: "책임과 꾸준함", role: "시험과 책임, 시간이 쌓아 주는 것" },
  uranus: { ko: "천왕성", glyph: "♅", area: "변화와 자유", role: "갑작스런 변화, 독창성, 자유" },
  neptune: { ko: "해왕성", glyph: "♆", area: "꿈과 직감", role: "꿈, 영감, 경계가 흐려지는 곳" },
  pluto: { ko: "명왕성", glyph: "♇", area: "깊은 변화", role: "끝과 재생, 집착과 힘" },
  asc: { ko: "상승점", glyph: "AC", area: "첫인상과 몸", role: "남에게 보이는 첫인상, 몸, 새 출발" },
  mc: { ko: "천정점", glyph: "MC", area: "일과 사회적 위치", role: "커리어, 목표, 사회적 평판" },
  node: { ko: "달의 교점", glyph: "☊", area: "인연의 방향", role: "" },
};

/* 별자리마다 '어떻게' 드러나는지 */
const SIGN_STYLE = [
  "거침없고 직선적으로", "느긋하고 꾸준하게", "가볍고 재치 있게", "다정하고 보호하듯이",
  "당당하고 화려하게", "꼼꼼하고 실용적으로", "부드럽고 균형 있게", "깊고 강렬하게",
  "넓고 자유롭게", "진지하고 계획적으로", "독특하고 객관적으로", "섬세하고 공감하며",
];
const MODALITY = ["활동", "고정", "변통"]; // 별자리 % 3
const ELEMENTS = ["불", "흙", "공기", "물"];  // 별자리 % 4

/* 하우스 주제 (홀사인) */
const HOUSE_TOPIC = [
  null,
  { short: "나 자신", long: "나 자신, 외모, 새 출발" },
  { short: "돈과 소유", long: "돈, 소유, 자존감" },
  { short: "대화와 이동", long: "대화, 연락, 가까운 이동, 형제" },
  { short: "집과 가족", long: "집, 가족, 마음의 뿌리" },
  { short: "연애와 즐거움", long: "연애, 창작, 놀이, 아이" },
  { short: "일상과 건강", long: "일상 업무, 건강, 습관" },
  { short: "파트너", long: "연인·배우자·동업자, 1:1 관계" },
  { short: "깊은 관계와 나눔", long: "공동의 돈, 깊은 친밀감, 변화" },
  { short: "공부와 여행", long: "공부, 먼 여행, 신념, 출판" },
  { short: "커리어", long: "커리어, 목표, 평판" },
  { short: "친구와 모임", long: "친구, 모임, 바라는 미래" },
  { short: "휴식과 내면", long: "휴식, 정리, 혼자만의 시간" },
];

/* 움직이는 천체가 만드는 영향: [조화, 긴장, 합] */
const TRANSIT_FX = {
  moon: ["마음이 편안해지고 하루가 부드럽게 흘러갑니다", "감정이 예민해져 작은 일에도 마음이 출렁입니다", "감정이 또렷해지고 그 부분에 마음이 쏠립니다"],
  sun: ["자신 있게 드러내면 인정받기 좋습니다", "의지가 부딪혀 고집 싸움이 생기기 쉽습니다", "스포트라이트가 그쪽으로 향하고 새 기운이 차오릅니다"],
  mercury: ["말과 생각이 잘 풀리고 연락이 순조롭습니다", "말실수나 오해, 일정 꼬임에 주의가 필요합니다", "생각이 많아지고 그 주제로 대화가 오갑니다"],
  venus: ["호감과 즐거움이 커지고 사람 운이 좋습니다", "기대와 현실이 엇갈려 서운함이나 지출이 생기기 쉽습니다", "매력이 올라가고 즐거운 만남이 따릅니다"],
  mars: ["추진력이 생겨 밀어붙이면 성과가 납니다", "조급함과 다툼, 사고 위험이 커집니다", "의욕이 불붙지만 서두르면 탈이 납니다"],
  jupiter: ["기회와 도움이 넓어지고 일이 커집니다", "욕심이 앞서 과하게 벌이기 쉽습니다", "행운이 찾아오고 마음이 넉넉해집니다"],
  saturn: ["꾸준히 쌓은 것이 단단한 결과로 돌아옵니다", "부담과 지연이 느껴지고 한계를 시험받습니다", "책임이 무거워지는 대신 기반이 다져집니다"],
  uranus: ["뜻밖의 좋은 변화와 새로운 자유가 찾아옵니다", "예상치 못한 변수로 계획이 흔들립니다", "틀을 깨는 변화가 시작됩니다"],
  neptune: ["직감과 영감이 맑아지고 마음이 너그러워집니다", "판단이 흐려지고 착각이나 실망이 생기기 쉽습니다", "꿈과 이상이 커지지만 현실 확인이 필요합니다"],
  pluto: ["깊이 파고들어 근본적인 힘을 얻습니다", "통제와 집착, 권력 다툼이 드러납니다", "오래된 것이 끝나고 새로 태어나는 과정에 있습니다"],
};

/* 천체별 할 일 / 피할 일 [조화일 때 할 일, 긴장일 때 피할 일] */
const TRANSIT_DO = {
  moon: ["좋아하는 음식으로 나를 챙기기", "감정 섞인 메시지 바로 보내기"],
  sun: ["내 생각을 당당히 말하기", "자존심 때문에 고집 부리기"],
  mercury: ["미뤄 둔 연락과 서류 처리", "확인 없이 계약·송금하기"],
  venus: ["좋아하는 사람과 시간 보내기", "기분 따라 큰 지출"],
  mars: ["운동이나 미뤄 둔 일 밀어붙이기", "운전·말다툼에서 조급하게 굴기"],
  jupiter: ["새 기회에 손 들기", "감당 못 할 약속 늘리기"],
  saturn: ["장기 계획 세우고 기초 다지기", "무리해서 혼자 다 떠안기"],
  uranus: ["새로운 방식 시도하기", "충동적으로 판 뒤엎기"],
  neptune: ["음악·명상·창작 즐기기", "흐릿한 말만 믿고 결정하기"],
  pluto: ["버릴 것 정리하기", "상대를 통제하려 들기"],
};

const ASPECT_PLAIN = { conj: "겹쳐", sextile: "60°로 도와", square: "90°로 부딪혀", trine: "120°로 조화를 이뤄", opp: "180°로 마주 봐" };

/* 트랜짓 분류: 힘(조화) / 긴장 / 주의 */
function transitCategory(t) {
  const n = t.aspect.nature;
  const benefic = ["sun", "moon", "mercury", "venus", "jupiter"].includes(t.transit);
  if (n === "soft" || (n === "mix" && benefic)) return "power";
  if (["mars", "saturn", "pluto", "neptune", "uranus"].includes(t.transit)) return "trouble";
  return "pressure";
}
const CATEGORY_KO = { power: { ko: "힘", desc: "밀어 주는 흐름" }, pressure: { ko: "긴장", desc: "부딪히며 움직이는 흐름" }, trouble: { ko: "주의", desc: "조심해서 넘어갈 흐름" } };

function transitSentence(t) {
  const T = BODY_KO[t.transit], N = BODY_KO[t.natal];
  const fx = TRANSIT_FX[t.transit][t.aspect.nature === "soft" ? 0 : t.aspect.nature === "hard" ? 1 : 2];
  return {
    title: `${T.ko} ${t.aspect.sym} 내 ${N.ko}`,
    line: `지금 ${josaWord(T.ko, "이/가")} 태어날 때의 ${josaWord(N.ko, "과/와")} ${ASPECT_PLAIN[t.aspect.key]} 있습니다. ${N.area} 쪽에서 ${fx}.`,
    phase: t.applying ? "점점 강해지는 중" : "지나가는 중",
  };
}

/* 받침에 맞춰 조사 */
function josa(word, withBatchim, without) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return without;
  return (c - 0xac00) % 28 ? withBatchim : without;
}
function josaWord(word, pair) { // pair: "이/가", "을/를", "은/는", "과/와"
  const [a, b] = pair.split("/");
  return word + josa(word, a, b);
}

/* 출생 차트 해설: 천체 × 별자리 × 하우스 */
function natalSentence(p) {
  const B = BODY_KO[p.id];
  const house = p.house ? ` ${HOUSE_TOPIC[p.house].long} 영역(${p.house}하우스)에서 특히 드러납니다.` : "";
  return `${josaWord(B.role, "이/가")} ${SIGNS[p.sign].ko}답게 ${SIGN_STYLE[p.sign]} 나타납니다.${house}`;
}

/* 이벤트 문장 */
function eventText(e) {
  const B = BODY_KO[e.body] || {};
  const S = SIGNS[e.sign];
  switch (e.type) {
    case "new": return { icon: "●", title: `${S.ko} 새달`, text: "새로 시작하고 씨앗을 심기 좋은 때" };
    case "full": return { icon: "○", title: `${S.ko} 보름달`, text: "결실과 감정이 크게 드러나는 때" };
    case "solarEclipse": return { icon: "◐", title: `${S.ko} 일식`, text: "새달보다 강한 시작. 큰 방향 전환의 신호" };
    case "lunarEclipse": return { icon: "◑", title: `${S.ko} 월식`, text: "보름보다 강한 마무리. 정리와 해방" };
    case "ingress": return { icon: B.glyph, title: `${josaWord(B.ko, "이/가")} ${S.ko}로`, text: e.retro ? "역행하며 이전 별자리로 돌아갑니다" : `${B.area}의 분위기가 ${S.ko}답게 바뀝니다` };
    case "stationR": return { icon: B.glyph + "℞", title: `${B.ko} 역행 시작`, text: e.body === "mercury" ? "연락·계약·기기 점검, 다시 보기" : `${josaWord(B.area, "을/를")} 돌아보는 시기` };
    case "stationD": return { icon: B.glyph + "D", title: `${B.ko} 순행 전환`, text: "멈췄던 일이 다시 앞으로 움직입니다" };
    default: return { icon: "·", title: "", text: "" };
  }
}

/* 하우스별 짧은 운세 (기간 운세에서 '태양/보름/역행이 n하우스를 지날 때') */
const HOUSE_FOCUS = [
  null,
  "나 자신에게 힘이 실립니다. 이미지 변신이나 새 출발에 좋습니다.",
  "돈과 소유가 화제입니다. 수입·지출을 점검하고 나의 가치를 매기세요.",
  "연락과 이동이 잦아집니다. 짧은 배움과 대화에서 실마리를 얻습니다.",
  "집과 가족에 마음이 갑니다. 쉬고 정리하며 뿌리를 다지세요.",
  "즐거움과 연애가 살아납니다. 좋아하는 일을 마음껏 표현하세요.",
  "일상과 건강을 다잡을 때입니다. 루틴을 고치면 효과가 큽니다.",
  "1:1 관계가 중심입니다. 파트너와의 약속과 조율이 중요합니다.",
  "깊은 관계와 공동의 돈이 화제입니다. 숨은 감정을 마주하세요.",
  "시야를 넓힐 때입니다. 공부·여행·새로운 생각이 행운을 부릅니다.",
  "일과 평판이 주목받습니다. 목표를 분명히 하고 성과를 보여 주세요.",
  "친구와 모임에서 기회가 옵니다. 함께할 사람을 찾으세요.",
  "속도를 늦추고 혼자 정리할 때입니다. 다음 주기를 준비하세요.",
];

/* 시너스트리 해설: 특별한 짝은 따로, 나머지는 천체 영역 조합 */
const SYN_SPECIAL = {
  "sun-moon": ["서로를 자연스럽게 채워 주는 짝입니다. 한쪽의 의지와 다른 쪽의 마음이 잘 맞물립니다.", "의지와 감정의 박자가 엇갈려, 서로의 필요를 말로 확인하는 노력이 필요합니다."],
  "venus-mars": ["강한 끌림과 설렘이 있는 짝입니다. 연애의 불꽃이 잘 튑니다.", "끌림은 강하지만 밀고 당기기가 거칠어질 수 있습니다."],
  "moon-moon": ["감정의 리듬이 닮아 함께 있으면 편안합니다.", "편안함을 느끼는 방식이 달라 서운함이 쌓이기 쉽습니다."],
  "mercury-mercury": ["말이 잘 통하고 대화가 즐겁습니다.", "생각하는 방식이 달라 말꼬리를 잡기 쉽습니다. 차이를 재미로 받아들이세요."],
  "sun-sun": ["서로의 삶의 방향을 인정하고 응원합니다.", "둘 다 주인공이 되고 싶어 부딪힙니다. 역할을 나누세요."],
  "venus-venus": ["취향과 즐거움을 함께 나누기 좋습니다.", "좋아하는 것이 달라 데이트 코스부터 조율이 필요합니다."],
  "sun-venus": ["서로에게 따뜻한 호감과 존중이 흐릅니다.", "호감은 있지만 기대하는 애정 표현이 다릅니다."],
  "moon-venus": ["다정하고 포근한 정이 흐릅니다.", "애정 표현과 안정감의 기준이 달라 엇갈릴 수 있습니다."],
  "mars-mars": ["함께 움직일 때 시너지가 큽니다.", "경쟁심이 붙으면 다툼이 커집니다."],
  "venus-saturn": ["오래가는 신뢰와 책임감이 있는 관계입니다.", "한쪽이 다른 쪽의 마음을 무겁게 누를 수 있습니다."],
  "moon-saturn": ["서로에게 든든한 버팀목이 됩니다.", "감정 표현이 차갑게 느껴질 수 있습니다. 따뜻한 말 한마디가 필요합니다."],
  "sun-saturn": ["서로를 단단하게 성장시킵니다.", "평가하고 평가받는 느낌이 들 수 있습니다."],
  "mars-saturn": ["함께 목표를 이루는 끈기가 있습니다.", "한쪽은 서두르고 한쪽은 막아 답답함이 생깁니다."],
  "sun-jupiter": ["함께 있으면 운이 넓어지고 낙관적이 됩니다.", "서로 기대가 커져 약속이 넘칠 수 있습니다."],
  "venus-jupiter": ["함께하면 즐겁고 너그러워집니다.", "즐거움에 치우쳐 씀씀이가 커질 수 있습니다."],
  "asc-sun": ["첫눈에 서로 눈에 띄는 짝입니다.", "첫인상과 실제 모습이 달라 놀랄 수 있습니다."],
  "asc-venus": ["상대의 모습 자체에 호감을 느낍니다.", "외모나 분위기에 대한 기대가 엇갈립니다."],
  "asc-moon": ["함께 있으면 마음이 놓입니다.", "상대의 기분에 쉽게 휩쓸립니다."],
};
function synastryText(s) {
  const key1 = `${s.a}-${s.b}`, key2 = `${s.b}-${s.a}`;
  const sp = SYN_SPECIAL[key1] || SYN_SPECIAL[key2];
  const hard = s.aspect.nature === "hard" || (s.aspect.nature === "mix" && ["saturn", "mars"].some((x) => x === s.a || x === s.b) && !(key1 === "venus-mars" || key2 === "venus-mars"));
  if (sp) return { text: sp[hard ? 1 : 0], hard };
  const A = BODY_KO[s.a], B = BODY_KO[s.b];
  return { text: hard ? `나의 ${josaWord(A.area, "과/와")} 상대의 ${josaWord(B.area, "이/가")} 부딪히며 자극을 주고받습니다.` : `나의 ${josaWord(A.area, "과/와")} 상대의 ${josaWord(B.area, "이/가")} 서로를 돕습니다.`, hard };
}
const SYN_GROUP = (s) => {
  const ks = [s.a, s.b];
  if (ks.includes("venus") && ks.includes("mars") || (ks.includes("venus") && (ks.includes("sun") || ks.includes("asc")))) return "attraction";
  if (ks.includes("mercury")) return "talk";
  if (ks.includes("moon")) return "comfort";
  if (ks.includes("saturn")) return "commit";
  return "growth";
};
const SYN_GROUP_KO = { attraction: "끌림", talk: "대화", comfort: "정서", commit: "책임과 지속", growth: "성장과 자극" };
