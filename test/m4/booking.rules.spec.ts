import { calculateEndTime, canTransition, intervalsOverlap } from '../../src/bookings/booking.rules';

/**
 * Shartnoma: src/bookings/booking.rules.ts  (sof funksiyalar, DB/Nest'ga bog'liq emas)
 *   calculateEndTime(startTime: Date, durationMinutes: number): Date
 *   canTransition(from: string, to: string): boolean
 *   intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean   // [start, end) yarim ochiq
 */
describe('M4 | Booking rules (unit)', () => {
  const d = (iso: string) => new Date(iso);

  describe('calculateEndTime', () => {
    it('boshlanish vaqtiga davomiylikni qo`shadi', () => {
      const end = calculateEndTime(d('2030-01-01T10:00:00.000Z'), 45);
      expect(end.toISOString()).toBe('2030-01-01T10:45:00.000Z');
    });

    it('yarim tundan o`tib ketishi mumkin', () => {
      const end = calculateEndTime(d('2030-01-01T23:30:00.000Z'), 60);
      expect(end.toISOString()).toBe('2030-01-02T00:30:00.000Z');
    });

    it('kirish Date obyektini o`zgartirmaydi (mutatsiya yo`q)', () => {
      const start = d('2030-01-01T10:00:00.000Z');
      calculateEndTime(start, 30);
      expect(start.toISOString()).toBe('2030-01-01T10:00:00.000Z');
    });

    it('oy/yil chegarasidan ham to`g`ri o`tadi', () => {
      const end = calculateEndTime(d('2030-12-31T23:59:00.000Z'), 2);
      expect(end.toISOString()).toBe('2031-01-01T00:01:00.000Z');
    });
  });

  describe('canTransition', () => {
    const allowed: Array<[string, string]> = [
      ['PENDING', 'CONFIRMED'],
      ['PENDING', 'CANCELLED'],
      ['CONFIRMED', 'COMPLETED'],
      ['CONFIRMED', 'CANCELLED'],
    ];
    const all = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];

    it.each(allowed)('%s -> %s ruxsat etiladi', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    const forbidden = all
      .flatMap((from) => all.map((to) => [from, to] as [string, string]))
      .filter(([f, t]) => !allowed.some(([af, at]) => af === f && at === t));

    it.each(forbidden)('%s -> %s TAQIQLANGAN', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });

    it('noma`lum status -> false (xato tashlamaydi)', () => {
      expect(canTransition('PENDING', 'FOO')).toBe(false);
      expect(canTransition('FOO', 'PENDING')).toBe(false);
    });
  });

  describe('intervalsOverlap', () => {
    const base = [d('2030-01-01T10:00:00Z'), d('2030-01-01T11:00:00Z')] as const;

    it.each([
      ['qisman kesishadi (chapdan)', '2030-01-01T09:30:00Z', '2030-01-01T10:30:00Z'],
      ['qisman kesishadi (o`ngdan)', '2030-01-01T10:30:00Z', '2030-01-01T11:30:00Z'],
      ['to`liq ichida', '2030-01-01T10:15:00Z', '2030-01-01T10:45:00Z'],
      ['to`liq o`rab oladi', '2030-01-01T09:00:00Z', '2030-01-01T12:00:00Z'],
      ['aynan bir xil', '2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z'],
    ])('kesishadi: %s', (_l, s, e) => {
      expect(intervalsOverlap(...base, d(s), d(e))).toBe(true);
      expect(intervalsOverlap(d(s), d(e), ...base)).toBe(true); // simmetriya
    });

    it.each([
      ['oldin tugaydi (yonma-yon)', '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z'],
      ['keyin boshlanadi (yonma-yon)', '2030-01-01T11:00:00Z', '2030-01-01T12:00:00Z'],
      ['ancha oldin', '2030-01-01T07:00:00Z', '2030-01-01T08:00:00Z'],
      ['ancha keyin', '2030-01-01T15:00:00Z', '2030-01-01T16:00:00Z'],
    ])('kesishmaydi: %s', (_l, s, e) => {
      expect(intervalsOverlap(...base, d(s), d(e))).toBe(false);
      expect(intervalsOverlap(d(s), d(e), ...base)).toBe(false);
    });
  });
});
