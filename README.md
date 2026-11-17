# 별자리판

황도 12궁을 회전 성좌판 하나로 한눈에 보고, 내 별자리의 오늘 운세를 확인하는 웹사이트입니다.

## 기능

- **회전 성좌판**: 원판을 드래그해 돌리면 상단 지침이 가리키는 날짜의 별자리와 그 성격, 신화가 나옵니다. 별자리를 클릭하면 그 별자리로 돌아가고, 키보드는 ←/→(이전·다음 별자리)와 Home(오늘)을 지원합니다.
- **오늘의 운세**: 별자리를 고르거나 생일을 입력하면 총운, 애정운, 금전운, 건강운과 행운의 색, 숫자, 방향, 시간, 물건, 잘 맞는 별자리를 보여 줍니다. 어제와 내일 운세도 볼 수 있습니다.
- 운세는 `날짜 + 별자리`로 시드를 만든 난수로 정하기 때문에, 같은 날 같은 별자리는 언제 열어도 결과가 같습니다.
- **밤하늘 (sky.html, 3D)**: 날짜, 시각, 장소(또는 내 위치)로 실제 별 1,654개와 88개 별자리의 위치를 계산합니다.
  - 올려다보기: 지면에 서서 끌어서 둘러보는 3D 하늘. 은하수, 별 반짝임, 대기, 달의 위상, 노을을 표현합니다.
  - 입체 우주: 별을 실제 거리(광년)로 옮겨 별자리 주위를 돌아봅니다.
  - 전천 지도: 머리 위 하늘 전체를 원 하나에 펼친 2D 지도.
  - 발견하기: 선과 이름을 숨긴 채 별을 눌러 별자리를 찾고, 찾은 별자리는 도감(브라우저 저장소)에 남습니다.
  - "내 위치에서 지금 하늘 보기"를 누르면 브라우저 위치 권한으로 현재 위치의 하늘과 보이는 별자리를 보여 줍니다. 위치는 브라우저 밖으로 보내지 않습니다.

## 실행

빌드 과정이 없는 정적 사이트입니다. 3D 밤하늘은 ES 모듈과 위치 권한을 쓰기 때문에 로컬 서버(또는 GitHub Pages 같은 https 주소)로 여세요.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## 배포 (GitHub Pages)

저장소의 Settings → Pages에서 Source를 `Deploy from a branch`, 브랜치를 `main` / `/ (root)`로 지정하면
`https://hyuny0219.github.io/horoscope/` 주소로 공개됩니다.

## 구조

```
index.html
css/style.css
js/data.js      12궁 별 좌표, 설명, 운세 문장
js/wheel.js     회전 성좌판 캔버스
js/fortune.js   날짜 기반 운세 생성
js/main.js      화면 연결
sky.html        밤하늘 전시실
js/sky-data.js  별 목록과 별자리 선 (tools/build_sky_data.py로 생성)
js/astro.js     천문 계산 (항성시, 지평좌표, 해와 달)
js/sky3d.js     3D 하늘 (Three.js, CDN에서 불러옴)
js/sky-view.js  2D 전천 지도
js/milkyway.js  은하수 생성
js/backdrop.js  페이지 배경의 실제 밤하늘
```

## 데이터 출처

- 별 위치와 별자리 선: [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD-3-Clause, `tools/LICENSE-d3-celestial.txt`)
- 별까지의 거리: [HYG Database](https://github.com/astronexus/HYG-Database) (CC BY-SA 4.0)

데이터를 다시 만들려면 위 원본 파일을 한 폴더에 받은 뒤 `python3 -I tools/build_sky_data.py <폴더> js/sky-data.js`를 실행합니다.

운세는 재미로 즐겨 주세요.
