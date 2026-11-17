/* 밤하늘 관측용 한국어 자료 */
const STAR_KO = {
  Sirius: "시리우스", Canopus: "카노푸스", Arcturus: "아르크투루스", Vega: "베가 (직녀성)", Capella: "카펠라",
  Rigel: "리겔", Procyon: "프로키온", Betelgeuse: "베텔게우스", Altair: "알타이르 (견우성)", Aldebaran: "알데바란",
  Spica: "스피카", Antares: "안타레스", Pollux: "폴룩스", Castor: "카스토르", Fomalhaut: "포말하우트",
  Deneb: "데네브", Regulus: "레굴루스", Polaris: "북극성", Bellatrix: "벨라트릭스", Algol: "알골",
  Mizar: "미자르", Dubhe: "두베", Alkaid: "알카이드", Denebola: "데네볼라", Hamal: "하말", Mirfak: "미르파크",
  Alphard: "알파르드", Alpheratz: "알페라츠", Rasalhague: "라스알하게", Alphecca: "알페카", Shaula: "샤울라",
  Alnilam: "알닐람", Alnitak: "알니탁", Mintaka: "민타카", Elnath: "엘나트", Kochab: "코카브", Nunki: "눈키",
};

/* 맨눈으로 찾기 좋은 별자리의 찾는 법 */
const CONST_GUIDE = {
  UMa: "국자 모양 일곱 별, 북두칠성이 이 별자리의 허리와 꼬리입니다. 국자 끝 두 별을 이어 다섯 배 늘리면 북극성에 닿습니다.",
  UMi: "꼬리 끝의 북극성은 거의 움직이지 않습니다. 북쪽을 찾을 때 가장 먼저 찾는 별입니다.",
  Cas: "북극성을 사이에 두고 북두칠성 반대편에 있는 W 모양 다섯 별입니다.",
  Ori: "가운데 나란히 선 삼태성과 붉은 베텔게우스, 푸른 리겔이 겨울 하늘의 표지판입니다.",
  CMa: "삼태성을 왼쪽 아래로 이으면 밤하늘에서 가장 밝은 별 시리우스가 나옵니다.",
  CMi: "시리우스, 베텔게우스와 함께 겨울철 대삼각형을 이루는 프로키온이 있습니다.",
  Tau: "붉은 알데바란과 V자 히아데스 성단, 그리고 좀생이별이라 불리는 플레이아데스가 함께 있습니다.",
  Gem: "나란히 빛나는 두 별 카스토르와 폴룩스가 쌍둥이의 머리입니다.",
  Aur: "노랗게 빛나는 카펠라를 꼭짓점으로 오각형을 이룹니다.",
  Leo: "물음표를 뒤집은 듯한 낫 모양 별들이 사자의 머리, 그 아래 레굴루스가 심장입니다.",
  Boo: "북두칠성 손잡이의 곡선을 따라가면 주황빛 아르크투루스에 닿습니다.",
  Vir: "아르크투루스에서 곡선을 더 이어 가면 하얀 스피카가 나옵니다. 봄철 대곡선입니다.",
  Lyr: "여름밤 머리 위에서 가장 밝게 빛나는 베가, 견우와 직녀 이야기의 직녀성입니다.",
  Aql: "은하수 건너편에서 베가를 마주 보는 알타이르, 견우성이 있습니다.",
  Cyg: "은하수 위를 날아가는 십자 모양 별들입니다. 꼬리의 데네브가 여름철 대삼각형의 한 꼭짓점입니다.",
  Sco: "남쪽 낮은 하늘에 S자로 굽은 별들과 붉은 안타레스가 보이면 전갈자리입니다.",
  Sgr: "전갈자리 동쪽, 주전자 모양 별들입니다. 운세에서는 사수자리라고 부릅니다. 주둥이 쪽이 은하수 중심입니다.",
  Peg: "가을 하늘의 커다란 사각형이 페가수스의 몸통입니다.",
  And: "페가수스 사각형의 한 모서리에서 이어지는 별줄기입니다. 근처에 맨눈으로도 보이는 안드로메다은하가 있습니다.",
  Per: "카시오페이아와 마차부자리 사이에 있습니다. 밝기가 변하는 별 알골이 유명합니다.",
  Her: "목동자리와 거문고자리 사이, 사다리꼴 몸통을 찾아보세요.",
  CrB: "목동자리 옆에 반원으로 놓인 작은 왕관입니다.",
};

/* 별자리 id → 운세 페이지 별자리 id */
const ZODIAC_LINK = {
  Ari: "aries", Tau: "taurus", Gem: "gemini", Cnc: "cancer", Leo: "leo", Vir: "virgo",
  Lib: "libra", Sco: "scorpio", Sgr: "sagittarius", Cap: "capricorn", Aqr: "aquarius", Psc: "pisces",
};

/* 관측 위치 (경도는 동경 +) */
const PLACES = [
  { id: "seoul", ko: "서울", lat: 37.57, lon: 126.98 },
  { id: "busan", ko: "부산", lat: 35.18, lon: 129.08 },
  { id: "daegu", ko: "대구", lat: 35.87, lon: 128.6 },
  { id: "gwangju", ko: "광주", lat: 35.16, lon: 126.85 },
  { id: "gangneung", ko: "강릉", lat: 37.75, lon: 128.88 },
  { id: "jeju", ko: "제주", lat: 33.5, lon: 126.53 },
];

/* 우리 옛 하늘의 이름 (동아시아 별자리 체계) */
const STAR_TRAD = {
  Polaris: "북극성", Sirius: "천랑성 (하늘의 늑대)", Canopus: "노인성 (수성노인)", Vega: "직녀성", Altair: "견우성",
  Antares: "대화성 (심수의 큰 불)", Arcturus: "대각성", Spica: "각수의 첫 별", Regulus: "헌원 열넷째 별",
  Dubhe: "북두칠성 천추", Merak: "북두칠성 천선", Phecda: "북두칠성 천기", Megrez: "북두칠성 천권",
  Alioth: "북두칠성 옥형", Mizar: "북두칠성 개양", Alkaid: "북두칠성 요광",
  Alnitak: "삼태성 (삼성)", Alnilam: "삼태성 (삼성)", Mintaka: "삼태성 (삼성)",
  Deneb: "천진 넷째 별", Capella: "오거 둘째 별", Aldebaran: "필수 다섯째 별", Fomalhaut: "북락사문",
  Castor: "북하 둘째 별", Pollux: "북하 셋째 별", Procyon: "남하 셋째 별", Betelgeuse: "삼수 넷째 별", Rigel: "삼수 일곱째 별",
};

/* 유명한 별 이야기 */
const STAR_STORY = {
  Sirius: "태양을 빼면 밤하늘에서 가장 밝은 별입니다. 8.6광년으로 아주 가까워서 밝게 보입니다. 옆에 흰색 왜성 동반성이 돌고 있습니다.",
  Canopus: "두 번째로 밝은 별이지만 한국에서는 남쪽 지평선에 아주 낮게 잠깐 떠서, 보면 오래 산다는 노인성 전설이 생겼습니다.",
  Arcturus: "북두칠성 손잡이를 따라 곡선을 그리면 닿는 주황색 별입니다. 태양보다 25배쯤 큰 늙은 별입니다.",
  Vega: "여름밤 머리 위에서 가장 밝은 별, 견우와 직녀 이야기의 직녀입니다. 약 1만 2천 년 뒤에는 북극성이 됩니다.",
  Altair: "은하수 건너 베가를 마주 보는 견우성입니다. 아주 빠르게 자전해서 적도 쪽이 납작하게 부풀어 있습니다.",
  Capella: "노란 빛의 겨울 별입니다. 실은 태양 비슷한 거성 두 개가 서로를 도는 쌍성입니다.",
  Rigel: "오리온의 발에 있는 푸르고 뜨거운 초거성입니다. 태양보다 수만 배 밝습니다.",
  Betelgeuse: "오리온의 어깨에 있는 붉은 초거성입니다. 언젠가 초신성으로 폭발하면 낮에도 보일 만큼 밝아집니다.",
  Procyon: "겨울철 대삼각형의 한 꼭짓점입니다. 이름은 개보다 먼저 뜬다는 뜻으로, 큰개자리 시리우스보다 먼저 떠오릅니다.",
  Aldebaran: "황소의 붉은 눈입니다. 뒤를 따른다는 뜻의 이름처럼 플레이아데스 성단을 뒤쫓아 하늘을 건넙니다.",
  Antares: "전갈의 심장에서 붉게 타는 초거성입니다. 화성의 맞수라는 뜻의 이름을 가졌습니다.",
  Spica: "처녀가 든 보리 이삭입니다. 아주 가까이 붙어 도는 뜨거운 별 두 개로 이루어져 있습니다.",
  Pollux: "쌍둥이 형제 중 동생의 머리입니다. 주위를 도는 행성이 발견된 별입니다.",
  Castor: "쌍둥이 형제 중 형의 머리입니다. 망원경으로 보면 별 여섯 개가 얽힌 다중성입니다.",
  Deneb: "백조의 꼬리입니다. 2천 광년 넘게 떨어져 있는데도 1등성으로 보일 만큼 엄청나게 밝은 별입니다.",
  Regulus: "사자의 심장, 작은 왕이라는 이름의 별입니다. 황도 바로 위에 있어서 달이 자주 가리고 지나갑니다.",
  Fomalhaut: "가을 남쪽 하늘에 홀로 빛나는 별입니다. 먼지 고리가 둘러싸고 있어 행성이 태어나는 중입니다.",
  Polaris: "지구의 자전축이 가리키는 곳에 있어 밤새 거의 움직이지 않습니다. 옛날부터 길잡이 별이었습니다.",
  Mizar: "북두칠성 손잡이 가운데 별입니다. 눈이 좋은 사람은 바로 옆의 작은 별 알코르까지 둘로 볼 수 있어 시력 검사에 쓰였습니다.",
  Dubhe: "북두칠성 국자 끝의 별입니다. 메라크와 이어 다섯 배 늘리면 북극성을 찾을 수 있습니다.",
  Algol: "악마의 별이라 불립니다. 사흘에 한 번 몇 시간 동안 어두워지는데, 짝별이 앞을 가리기 때문입니다.",
  Mira: "놀라운 별이라는 뜻입니다. 11개월 주기로 밝아졌다가 맨눈에 안 보일 만큼 어두워집니다.",
  Alnilam: "오리온의 허리띠 가운데 별입니다. 셋이 나란히 선 삼태성은 겨울 하늘을 찾는 가장 쉬운 표지입니다.",
};

const GREEK_KO = { α: "알파", β: "베타", γ: "감마", δ: "델타", ε: "엡실론", ζ: "제타", η: "에타", θ: "세타", ι: "이오타", κ: "카파", λ: "람다", μ: "뮤", ν: "뉴", ξ: "크시", ο: "오미크론", π: "파이", ρ: "로", σ: "시그마", τ: "타우", υ: "입실론", φ: "피", χ: "카이", ψ: "프시", ω: "오메가" };

const NAMED_BY_INDEX = new Map(SKY_NAMED.map(([en, i, ko, bayer, con]) => [i, { en, ko, bayer, con }]));

/* 화면에 쓸 별 이름 (이름 없는 별은 null) */
function starName(i) {
  const n = NAMED_BY_INDEX.get(i);
  return n ? STAR_KO[n.en] || n.ko || n.en : null;
}

/* 별 카드에 쓸 정보 */
function starInfo(i) {
  const [ra, dec, mag, bv, ly] = SKY_STARS[i];
  const n = NAMED_BY_INDEX.get(i);
  const conId = n?.con || (typeof CONSTELLATIONS !== "undefined" ? CONSTELLATIONS.find((c) => c.segs.some((s) => s.includes(i)))?.id : null);
  const con = typeof CONST_BY_ID !== "undefined" && conId ? CONST_BY_ID[conId] : null;
  const temp = Math.round((4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))) / 100) * 100; // B-V로 어림한 표면 온도
  const colorWord = bv < 0 ? "푸른 흰색" : bv < 0.3 ? "흰색" : bv < 0.6 ? "노르스름한 흰색" : bv < 1.0 ? "노란색" : bv < 1.4 ? "주황색" : "붉은 주황색";
  const year = new Date().getFullYear() - Math.round(ly);
  return {
    i, ra, dec, mag, ly, temp, colorWord,
    name: starName(i) || (con ? `${con.ko}의 별` : "이름 없는 별"),
    en: n?.en || "", trad: n ? STAR_TRAD[n.en] : null, story: n ? STAR_STORY[n.en] : null,
    bayer: n?.bayer && con ? `${con.ko} ${GREEK_KO[n.bayer] || n.bayer}별 (${n.bayer} ${conId})` : "",
    con, conId, rank: i + 1, // SKY_STARS는 밝은 순으로 정렬되어 있다
    magClass: mag < 1.5 ? "1등성" : `${Math.round(mag)}등성`,
    lightYear: !ly ? null : year > 0 ? `${year}년` : `기원전 ${1 - year}년`,
  };
}
