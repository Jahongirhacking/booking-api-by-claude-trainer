/**
 * Xavfsizlik qo'riqchisi: testlar hech qachon development/production bazasiga
 * tegmasligi kerak. Baza nomi `_test` bilan tugamasa, testlar to'xtatiladi.
 * (global-setup dropDatabase() chaqiradi, xato bazada bu fojia bo'lardi.)
 */
export function assertTestDatabase(): void {
  const name = process.env.DB_NAME ?? '';
  if (process.env.NODE_ENV !== 'test' || !name.endsWith('_test')) {
    throw new Error(
      `[TEST GUARD] Test bazasi noto'g'ri sozlangan: DB_NAME="${name}", NODE_ENV="${process.env.NODE_ENV}". ` +
        `.env.test faylida DB_NAME "_test" bilan tugashi kerak (masalan booking_test).`,
    );
  }
}
