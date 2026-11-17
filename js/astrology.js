/* 실제 하늘 계산을 운세에 연결한다 (서양 점성술의 열대 황도 12궁 기준)
 * 필요: astro.js (sunPosition, moonPosition, localSiderealDeg, obliquity), data.js (SIGNS)
 */
const signOfLongitude = (lam) => Math.floor((((lam % 360) + 360) % 360) / 30); // 0 = 양자리

/* 상승궁: 태어난 순간 동쪽 지평선에 떠오르던 황도 위치 */
function ascendantLongitude(ms, latDeg, lonDeg) {
  const th = localSiderealDeg(ms, lonDeg) * DEG, e = obliquity(ms) * DEG, p = latDeg * DEG;
  const lam = Math.atan2(Math.cos(th), -(Math.sin(th) * Math.cos(e) + Math.tan(p) * Math.sin(e)));
  return ((lam / DEG) % 360 + 360) % 360;
}

/* birth: {y, m, d, hh?, mm?, lat, lon, tz} — 시각을 모르면 정오로 두고 상승궁은 계산하지 않는다 */
function birthChart(birth) {
  const known = Number.isFinite(birth.hh);
  const ms = Date.UTC(birth.y, birth.m - 1, birth.d, (known ? birth.hh : 12) - birth.tz, known ? birth.mm || 0 : 0);
  const sun = signOfLongitude(sunPosition(ms).lam);
  const moon = signOfLongitude(moonPosition(ms).lam);
  const rising = known ? signOfLongitude(ascendantLongitude(ms, birth.lat, birth.lon)) : null;
  return { sun, moon, rising, timeKnown: known };
}

/* 오늘(정오 기준) 하늘 */
function skyOfDay(date) {
  const ms = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 3); // 한국 정오
  const moon = moonPosition(ms), sun = sunPosition(ms);
  return { moonSign: signOfLongitude(moon.lam), sunSign: signOfLongitude(sun.lam), moon, phase: moonPhaseName(moon) };
}

/* 두 별자리 사이의 각도 관계 */
function aspectBetween(a, b) {
  const d = (b - a + 12) % 12;
  if (d === 0) return ASPECTS.conj;
  if (d === 6) return ASPECTS.opp;
  if (d === 4 || d === 8) return ASPECTS.trine;
  if (d === 3 || d === 9) return ASPECTS.square;
  if (d === 2 || d === 10) return ASPECTS.sextile;
  return ASPECTS.minor;
}

const ASPECTS = {
  conj: { name: "합 (같은 자리)", mod: 1, love: 1, text: "달이 당신의 별자리 위에 떠 있습니다. 감정이 또렷해지고 하고 싶은 일이 분명해지는 날입니다." },
  trine: { name: "120° 조화", mod: 1, love: 0, text: "달이 같은 원소의 별자리에서 당신을 비춥니다. 힘을 크게 들이지 않아도 일이 자연스럽게 흘러갑니다." },
  sextile: { name: "60° 기회", mod: 0, love: 1, text: "달이 당신과 잘 어울리는 자리에 있습니다. 먼저 말을 걸거나 손을 내밀면 좋은 기회로 이어집니다." },
  square: { name: "90° 긴장", mod: -1, love: 0, text: "달이 당신과 엇갈리는 자리에 있습니다. 작은 마찰이 생기기 쉽지만, 그만큼 미뤄 둔 일을 밀어붙일 힘도 생깁니다." },
  opp: { name: "180° 마주 봄", mod: 0, love: -1, text: "달이 정반대 자리에서 당신을 마주 봅니다. 다른 사람의 시선이 신경 쓰이는 날이니, 상대의 입장에서 한 번 더 생각해 보세요." },
  minor: { name: "느슨한 연결", mod: 0, love: 0, text: "달이 당신과 조용한 거리를 두고 있습니다. 큰 흔들림 없이 내 속도대로 지내기 좋은 날입니다." },
};

const PHASE_TEXT = {
  "삭 (보이지 않는 달)": "달이 보이지 않는 그믐과 초승 사이입니다. 새 계획의 씨앗을 심기 좋습니다.",
  "초승달": "가느다란 초승달이 차오르는 중입니다. 작게 시작한 일에 힘이 붙습니다.",
  "상현달": "반달이 차오르는 상현입니다. 망설이던 결정을 실행에 옮길 때입니다.",
  "차오르는 달": "보름을 앞두고 달이 부풀어 오릅니다. 마무리 직전의 일을 다듬기 좋습니다.",
  "보름달": "보름달이 떴습니다. 감정이 크게 일렁이고, 그동안 쌓아 온 일이 결실을 맺습니다.",
  "기우는 달": "보름이 지나 달이 기울기 시작했습니다. 얻은 것을 나누고 감사를 전하기 좋습니다.",
  "하현달": "반달이 기우는 하현입니다. 필요 없는 것을 덜어 내고 정리할 때입니다.",
  "그믐달": "새벽에만 보이는 그믐달입니다. 속도를 늦추고 쉬면서 다음을 준비하세요.",
};

/* 달이 있는 별자리 = 그날의 감정 분위기 / 출생 달궁 = 감정 성향 */
const MOON_IN = [
  "충동적이고 솔직한 감정", "느긋하고 안정을 찾는 마음", "호기심 많고 말이 많아지는 기분", "가족과 집이 그리워지는 마음",
  "칭찬받고 싶고 당당해지는 기분", "작은 것까지 정리하고 싶은 마음", "조화와 아름다움을 찾는 마음", "깊이 파고들고 싶은 감정",
  "멀리 떠나고 싶은 마음", "책임감이 커지는 진지한 마음", "혼자만의 생각을 따르고 싶은 기분", "감수성이 풍부해지는 마음",
];
const RISING_IN = [
  "에너지 넘치고 시원시원한 사람", "차분하고 믿음직한 사람", "재치 있고 말이 잘 통하는 사람", "다정하고 보살펴 주는 사람",
  "눈에 띄고 따뜻한 사람", "단정하고 꼼꼼한 사람", "부드럽고 세련된 사람", "신비롭고 속을 알기 어려운 사람",
  "밝고 자유로운 사람", "어른스럽고 단단한 사람", "독특하고 친구 같은 사람", "몽글몽글하고 공감 잘하는 사람",
];

const KEYWORDS = {
  "불": ["도전", "첫걸음", "자신감", "열정", "속도", "용기", "주도권", "승부", "모험", "빛", "결단", "응원"],
  "흙": ["꾸준함", "정리", "저축", "루틴", "현실 감각", "손재주", "건강 습관", "인내", "기초", "신뢰", "결실", "단골"],
  "공기": ["대화", "아이디어", "연락", "배움", "여행", "균형", "유머", "네트워크", "메모", "새 친구", "정보", "가벼움"],
  "물": ["직감", "공감", "위로", "추억", "예술", "휴식", "마음의 소리", "치유", "음악", "눈물", "포옹", "깊은 잠"],
};

const MISSIONS = [
  "고마운 사람에게 짧은 메시지 보내기", "10분 동안 휴대폰 없이 걷기", "오늘 할 일 세 개만 적고 지키기", "물 여섯 잔 마시기",
  "밤에 창밖 하늘을 1분 올려다보기", "책상 위 물건 다섯 개 치우기", "처음 가 보는 길로 돌아가기", "좋아하는 노래 한 곡 끝까지 듣기",
  "오늘 잘한 일 하나 적어 두기", "평소보다 30분 일찍 잠자리에 들기", "누군가의 이야기를 끝까지 듣기", "새로운 메뉴 하나 시도하기",
  "미뤄 둔 연락 하나 끝내기", "스트레칭 5분 하기", "지갑이나 가방 정리하기", "칭찬 한마디 먼저 건네기",
  "오래된 사진 한 장 꺼내 보기", "따뜻한 차 한 잔 천천히 마시기", "작은 기부나 친절 하나 실천하기", "내일 입을 옷 미리 골라 두기",
];
const AVOID = [
  "충동구매", "늦은 밤 야식", "확인하지 않은 소문 전하기", "약속 시간 아슬아슬하게 가기", "과한 카페인",
  "남과 비교하기", "답장을 미루기", "한 번에 너무 많은 일 맡기", "감정적인 메시지 바로 보내기", "무리한 운동",
  "중요한 결정 서두르기", "빌려준 돈 독촉하기", "밤새 화면 보기", "오래된 다툼 다시 꺼내기", "건너뛴 끼니",
];

/* 별 카드: 실제 밝은 별의 이야기를 담은 오늘의 메시지 */
const STAR_CARDS = [
  { star: "북극성", con: "작은곰자리", msg: "하늘이 돌아도 북극성은 제자리에 있습니다. 흔들릴 때는 처음 정한 방향을 떠올리세요." },
  { star: "시리우스", con: "큰개자리", msg: "밤하늘에서 가장 밝은 별입니다. 오늘은 숨기지 말고 당신의 재능을 드러내세요." },
  { star: "베가 (직녀성)", con: "거문고자리", msg: "은하수 건너 견우를 기다리는 직녀처럼, 기다림 끝에 반가운 소식이 옵니다." },
  { star: "알타이르 (견우성)", con: "독수리자리", msg: "멀리 있는 사람과의 거리가 좁혀집니다. 먼저 다리를 놓아 보세요." },
  { star: "안타레스", con: "전갈자리", msg: "붉게 타는 전갈의 심장입니다. 마음속 열정을 한 가지 일에 모으면 크게 빛납니다." },
  { star: "스피카", con: "처녀자리", msg: "보리 이삭을 뜻하는 별입니다. 그동안 심어 둔 노력이 수확으로 돌아옵니다." },
  { star: "레굴루스", con: "사자자리", msg: "작은 왕이라는 이름의 별입니다. 오늘은 주인공처럼 당당하게 행동해도 좋습니다." },
  { star: "알데바란", con: "황소자리", msg: "좀생이별을 뒤따르는 별입니다. 서두르지 말고 꾸준히 따라가면 목표에 닿습니다." },
  { star: "베텔게우스", con: "오리온자리", msg: "언젠가 폭발할 거대한 별입니다. 변화를 두려워하지 마세요. 끝은 새로운 시작입니다." },
  { star: "리겔", con: "오리온자리", msg: "푸르고 뜨거운 별입니다. 머리를 차갑게, 마음은 뜨겁게 유지하면 길이 보입니다." },
  { star: "카펠라", con: "마차부자리", msg: "아기 염소를 뜻하는 별입니다. 누군가를 돌보는 마음이 당신에게 행운으로 돌아옵니다." },
  { star: "아르크투루스", con: "목동자리", msg: "곰을 지키는 별입니다. 소중한 것을 지키려는 마음이 오늘 당신을 강하게 만듭니다." },
  { star: "데네브", con: "백조자리", msg: "아주 멀리 있지만 밝게 보이는 별입니다. 멀게 느껴지는 꿈도 생각보다 가까이 있습니다." },
  { star: "포말하우트", con: "남쪽물고기자리", msg: "가을 남쪽 하늘에 홀로 빛나는 별입니다. 혼자인 시간이 오히려 당신을 빛나게 합니다." },
  { star: "프로키온", con: "작은개자리", msg: "개보다 먼저 뜬다는 뜻의 별입니다. 남보다 한 발 먼저 준비하면 기회를 잡습니다." },
  { star: "플레이아데스", con: "황소자리", msg: "일곱 자매 별무리입니다. 혼자보다 함께할 때 운이 커지는 날입니다." },
];

/* 궁합: 두 사람의 별 지도 */
function compatibility(a, b) {
  const el = (i) => SIGNS[i].element;
  const elementScore = el(a.sun) === el(b.sun) ? 92 : ELEMENT_MATCH[el(a.sun)].includes(el(b.sun)) ? 84 : 58;
  const aspScore = (x, y) => ({ conj: 88, trine: 95, sextile: 86, square: 55, opp: 70, minor: 66 })[aspectKey(x, y)];
  const sunScore = aspScore(a.sun, b.sun), moonScore = aspScore(a.moon, b.moon);
  const total = Math.round(sunScore * 0.4 + moonScore * 0.35 + elementScore * 0.25);
  return { total, sunScore, moonScore, elementScore, sunAspect: aspectBetween(a.sun, b.sun), moonAspect: aspectBetween(a.moon, b.moon) };
}
function aspectKey(a, b) {
  const asp = aspectBetween(a, b);
  return Object.keys(ASPECTS).find((k) => ASPECTS[k] === asp);
}
const COMPAT_TEXT = [
  { min: 88, text: "별이 서로를 비추는 사이입니다. 말하지 않아도 통하는 순간이 많습니다." },
  { min: 78, text: "편안하고 든든한 사이입니다. 서로의 속도를 존중하면 오래 갑니다." },
  { min: 68, text: "다른 점이 오히려 끌림이 되는 사이입니다. 차이를 배움으로 바꿔 보세요." },
  { min: 0, text: "부딪히는 만큼 성장하는 사이입니다. 감정이 올라올 땐 하루 쉬고 다시 이야기하세요." },
];
