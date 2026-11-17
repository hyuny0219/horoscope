/* 출생지 고르기: 나라 → 도시, 그리고 태어난 순간 그 도시의 시차
 * 필요: places-data.js (WORLD_TZ, WORLD_CITIES) */
const WorldPlace = (() => {
  const regionKo = (() => { try { const d = new Intl.DisplayNames(["ko"], { type: "region" }); return (cc) => { try { return d.of(cc) || cc; } catch { return cc; } }; } catch { return (cc) => cc; } })();
  const PINNED = ["KR", "US", "JP", "CN", "CA", "AU", "GB", "DE", "FR", "VN", "PH", "TH", "NZ", "SG", "TW", "HK"];
  const countries = Object.keys(WORLD_CITIES).map((cc) => ({ cc, ko: regionKo(cc) }));
  const others = countries.filter((c) => !PINNED.includes(c.cc)).sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
  const pinned = PINNED.filter((cc) => WORLD_CITIES[cc]).map((cc) => countries.find((c) => c.cc === cc));

  /* IANA 시간대에서 그 지역 시각(y, m, d, hh, mm)의 UTC 시차(시간). 서머타임과 옛 표준시까지 브라우저 자료로 */
  function offsetHours(tz, y, m, d, hh = 12, mm = 0) {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    const offAt = (utc) => {
      const p = Object.fromEntries(fmt.formatToParts(new Date(utc)).filter((x) => x.type !== "literal").map((x) => [x.type, +x.value]));
      return (Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - utc) / 3600000;
    };
    const wall = Date.UTC(y, m - 1, d, hh, mm);
    let off = offAt(wall - 9 * 3600000);
    off = offAt(wall - off * 3600000);
    return off;
  }

  /* select 두 개를 나라 → 도시로 연결한다 */
  function bind(countrySel, citySel, initial = { cc: "KR", city: "서울" }) {
    if (!countrySel || !citySel) return null;
    countrySel.replaceChildren();
    const g1 = document.createElement("optgroup"); g1.label = "자주 찾는 나라";
    pinned.forEach((c) => g1.append(new Option(c.ko, c.cc)));
    const g2 = document.createElement("optgroup"); g2.label = "모든 나라 (가나다순)";
    others.forEach((c) => g2.append(new Option(c.ko, c.cc)));
    countrySel.append(g1, g2);
    const fill = (cc, city) => {
      const list = WORLD_CITIES[cc] || [];
      citySel.replaceChildren(...list.map((c, i) => new Option(c[0], i)));
      const i = city ? list.findIndex((c) => c[0] === city) : 0;
      citySel.value = String(Math.max(0, i));
    };
    countrySel.addEventListener("change", () => fill(countrySel.value));
    countrySel.value = WORLD_CITIES[initial.cc] ? initial.cc : "KR";
    fill(countrySel.value, initial.city);
    return {
      get() {
        const cc = countrySel.value, c = (WORLD_CITIES[cc] || [])[Number(citySel.value)] || WORLD_CITIES.KR[0];
        return { cc, country: regionKo(cc), city: c[0], lat: c[1], lon: c[2], zone: WORLD_TZ[c[3]] };
      },
      set({ cc, city }) { if (WORLD_CITIES[cc]) { countrySel.value = cc; fill(cc, city); } },
    };
  }

  /* 폼 값 → birth 객체 (natalChart가 쓰는 tz는 태어난 순간의 시차) */
  function toBirth(dateStr, timeStr, place) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const b = { y, m, d, lat: place.lat, lon: place.lon, cc: place.cc, zone: place.zone, place: place.cc === "KR" ? place.city : `${place.city}, ${place.country}` };
    if (timeStr) { const [hh, mm] = timeStr.split(":").map(Number); b.hh = hh; b.mm = mm; }
    b.tz = offsetHours(place.zone, y, m, d, Number.isFinite(b.hh) ? b.hh : 12, b.mm || 0);
    return b;
  }

  return { bind, toBirth, offsetHours, regionKo };
})();
