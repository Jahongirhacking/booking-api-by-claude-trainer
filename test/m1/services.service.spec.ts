import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ServicesService } from '../../src/services/services.service';

/**
 * Shartnoma (contract): ServicesService quyidagi metodlarga ega bo'lishi kerak:
 *   create(dto), findAll(), findOne(id), update(id, dto), remove(id)
 * Ichki saqlash usuli (Map, Array, ...) muhim emas.
 */
describe('M1 | ServicesService (unit)', () => {
  let service: ServicesService;

  const dto = {
    name: 'Haircut',
    description: 'Classic haircut',
    durationMinutes: 30,
    price: 50000,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ServicesService],
    }).compile();
    service = moduleRef.get(ServicesService);
  });

  it('create: id va createdAt bilan yangi xizmat qaytaradi', async () => {
    const created = await service.create({ ...dto });

    expect(created.id).toEqual(expect.any(String));
    expect(created.name).toBe('Haircut');
    expect(created.durationMinutes).toBe(30);
    expect(created.price).toBe(50000);
    expect(created.createdAt).toBeDefined();
  });

  it('create: har bir xizmat noyob id oladi', async () => {
    const a = await service.create({ ...dto, name: 'A' });
    const b = await service.create({ ...dto, name: 'B' });
    expect(a.id).not.toBe(b.id);
  });

  it('create: nomi takrorlansa ConflictException (katta-kichik harf farqsiz)', async () => {
    await service.create({ ...dto });
    await expect(service.create({ ...dto, name: 'haircut' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('findAll: boshida bo`sh massiv', async () => {
    await expect(service.findAll()).resolves.toEqual([]);
  });

  it('findAll: barcha yaratilganlarni qaytaradi', async () => {
    await service.create({ ...dto, name: 'A' });
    await service.create({ ...dto, name: 'B' });
    const all = await service.findAll();
    expect(all).toHaveLength(2);
  });

  it('findOne: mavjud xizmatni qaytaradi', async () => {
    const created = await service.create({ ...dto });
    const found = await service.findOne(created.id);
    expect(found.id).toBe(created.id);
  });

  it('findOne: topilmasa NotFoundException', async () => {
    await expect(service.findOne('does-not-exist')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update: faqat berilgan maydonlarni o`zgartiradi', async () => {
    const created = await service.create({ ...dto });
    const updated = await service.update(created.id, { price: 70000 });

    expect(updated.price).toBe(70000);
    expect(updated.name).toBe('Haircut');
    expect(updated.durationMinutes).toBe(30);
  });

  it('update: o`z nomini qayta yuborish Conflict bermaydi', async () => {
    const created = await service.create({ ...dto });
    await expect(service.update(created.id, { name: 'Haircut' })).resolves.toBeDefined();
  });

  it('update: boshqa xizmat nomini olsa ConflictException', async () => {
    await service.create({ ...dto, name: 'A' });
    const b = await service.create({ ...dto, name: 'B' });
    await expect(service.update(b.id, { name: 'a' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('update: topilmasa NotFoundException', async () => {
    await expect(service.update('nope', { price: 1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove: o`chiriladi va keyin findOne NotFound beradi', async () => {
    const created = await service.create({ ...dto });
    await service.remove(created.id);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove: topilmasa NotFoundException', async () => {
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
