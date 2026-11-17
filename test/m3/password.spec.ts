import { hashPassword, verifyPassword } from '../../src/auth/password';

/**
 * Shartnoma: src/auth/password.ts
 *   hashPassword(plain: string): Promise<string>     (bcrypt)
 *   verifyPassword(plain: string, hash: string): Promise<boolean>
 */
describe('M3 | Password util (unit)', () => {
  it('hash oddiy paroldan farq qiladi va bcrypt formatida ($2...)', async () => {
    const hash = await hashPassword('Passw0rd!123');
    expect(hash).not.toBe('Passw0rd!123');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('bir xil parol ikki marta turlicha hash beradi (salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('same-pass-1'), hashPassword('same-pass-1')]);
    expect(a).not.toBe(b);
  });

  it('verifyPassword: to`g`ri parol -> true', async () => {
    const hash = await hashPassword('Passw0rd!123');
    await expect(verifyPassword('Passw0rd!123', hash)).resolves.toBe(true);
  });

  it('verifyPassword: noto`g`ri parol -> false', async () => {
    const hash = await hashPassword('Passw0rd!123');
    await expect(verifyPassword('passw0rd!123', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });
});
