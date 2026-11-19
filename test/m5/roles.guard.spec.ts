import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../../src/auth/decorators/roles.decorator';
import { RolesGuard } from '../../src/rbac/guards/roles.guard';

/**
 * Shartnoma:
 *   src/auth/decorators/roles.decorator.ts  -> @Roles(...roles: string[])  (metadata o'rnatadi)
 *   src/auth/guards/roles.guard.ts          -> RolesGuard(reflector: Reflector).canActivate(ctx)
 *   request.user.role — JwtStrategy qo'ygan foydalanuvchi roli
 * Qoidalar:
 *   - @Roles yo'q -> ruxsat (true)
 *   - @Roles bor, user roli ro'yxatda -> true, aks holda -> false
 *   - method darajasidagi @Roles class darajasini OVERRIDE qiladi
 *   - request.user yo'q -> false
 */
class OpenController {
  handle() {}
}

class AdminOnlyController {
  @Roles('ADMIN')
  handle() {}

  @Roles('STAFF', 'ADMIN')
  multi() {}
}

@Roles('ADMIN')
class AdminClassController {
  inherited() {}

  @Roles('CUSTOMER')
  overridden() {}
}

const ctx = (
  cls: any,
  method: string,
  user?: { role: string },
): ExecutionContext =>
  ({
    getClass: () => cls,
    getHandler: () => cls.prototype[method],
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('M5 | RolesGuard (unit)', () => {
  const guard = new RolesGuard(new Reflector());
  const can = async (c: ExecutionContext) =>
    Boolean(await guard.canActivate(c));

  it('@Roles yo`q -> ruxsat', async () => {
    expect(await can(ctx(OpenController, 'handle', { role: 'CUSTOMER' }))).toBe(
      true,
    );
  });

  it('@Roles("ADMIN"): ADMIN o`tadi', async () => {
    expect(
      await can(ctx(AdminOnlyController, 'handle', { role: 'ADMIN' })),
    ).toBe(true);
  });

  it.each(['CUSTOMER', 'STAFF'])(
    '@Roles("ADMIN"): %s o`tmaydi',
    async (role) => {
      expect(await can(ctx(AdminOnlyController, 'handle', { role }))).toBe(
        false,
      );
    },
  );

  it('bir nechta rol: STAFF va ADMIN o`tadi, CUSTOMER o`tmaydi', async () => {
    expect(
      await can(ctx(AdminOnlyController, 'multi', { role: 'STAFF' })),
    ).toBe(true);
    expect(
      await can(ctx(AdminOnlyController, 'multi', { role: 'ADMIN' })),
    ).toBe(true);
    expect(
      await can(ctx(AdminOnlyController, 'multi', { role: 'CUSTOMER' })),
    ).toBe(false);
  });

  it('class darajasidagi @Roles metodlarga ham tarqaladi', async () => {
    expect(
      await can(ctx(AdminClassController, 'inherited', { role: 'ADMIN' })),
    ).toBe(true);
    expect(
      await can(ctx(AdminClassController, 'inherited', { role: 'CUSTOMER' })),
    ).toBe(false);
  });

  it('method darajasidagi @Roles class darajasini override qiladi', async () => {
    expect(
      await can(ctx(AdminClassController, 'overridden', { role: 'CUSTOMER' })),
    ).toBe(true);
    expect(
      await can(ctx(AdminClassController, 'overridden', { role: 'ADMIN' })),
    ).toBe(false);
  });

  it('request.user yo`q bo`lsa (himoyalangan route) -> false', async () => {
    expect(await can(ctx(AdminOnlyController, 'handle', undefined))).toBe(
      false,
    );
  });
});
