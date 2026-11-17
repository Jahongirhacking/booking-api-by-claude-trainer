/**
 * Kelajakdagi barqaror "slot" bazasi: bugundan 30 kun keyin, 10:00 UTC.
 * Testlar `at(0)`, `at(30)`, `at(60)` kabi minut siljishlari bilan ishlaydi.
 */
const BASE = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  d.setUTCHours(10, 0, 0, 0);
  return d.getTime();
})();

/** BASE dan `minutes` daqiqa keyingi vaqt (ISO string). */
export const at = (minutes: number): string => new Date(BASE + minutes * 60_000).toISOString();

/** `minutes` daqiqa OLDINGI vaqt (o'tmishdagi Date). */
export const ago = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);
