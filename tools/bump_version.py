"""배포할 때마다 CSS·JS 주소에 붙는 ?v= 값을 바꾼다.

GitHub Pages는 파일을 브라우저에 10분쯤 캐시하게 한다. 새 index.html과 캐시에 남은 옛 JS가 섞이면
페이지가 멈출 수 있으므로, 주소를 바꿔 늘 같은 판의 파일을 함께 받게 한다.

    python3 -I tools/bump_version.py          # 지금 시각으로
    python3 -I tools/bump_version.py 20261117a
"""
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ver = sys.argv[1] if len(sys.argv) > 1 else time.strftime("%Y%m%d%H%M")

for name in ["index.html", "zodiac.html"]:
    p = ROOT / name
    s = p.read_text(encoding="utf-8")
    s = re.sub(r'((?:src|href)="(?:js|css)/[\w.-]+\.(?:js|css))(?:\?v=[\w]+)?"', rf'\1?v={ver}"', s)
    p.write_text(s, encoding="utf-8")

p = ROOT / "js" / "sky-page.js"
s = p.read_text(encoding="utf-8")
s = re.sub(r'import\("\./sky3d\.js(?:\?v=[\w]+)?"\)', f'import("./sky3d.js?v={ver}")', s)
p.write_text(s, encoding="utf-8")
print("version", ver)
