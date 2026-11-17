import { DataSource } from 'typeorm';

/** Migratsiyalar jadvalidan tashqari barcha entity jadvallarini tozalaydi. */
export async function truncateAll(ds: DataSource): Promise<void> {
  const tables = ds.entityMetadatas.map((m) => `"${m.tableName}"`);
  if (tables.length > 0) {
    await ds.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let counter = 0;
const next = () => ++counter;

// Entity klasslariga yo'l bilan emas, NOMI bilan murojaat qilamiz (User, Service, Staff, Booking).
type Overrides = Record<string, unknown>;

export async function createUser(ds: DataSource, o: Overrides = {}) {
  const repo = ds.getRepository('User');
  return repo.save(
    repo.create({
      email: `user${next()}@test.com`,
      fullName: 'Test User',
      passwordHash: 'hashed-password',
      ...o,
    }),
  );
}

export async function createService(ds: DataSource, o: Overrides = {}) {
  const repo = ds.getRepository('Service');
  return repo.save(
    repo.create({
      name: `Service ${next()}`,
      durationMinutes: 30,
      price: 100,
      ...o,
    }),
  );
}

export async function createStaff(ds: DataSource, o: Overrides = {}) {
  const repo = ds.getRepository('Staff');
  const user = (o.user as object) ?? (await createUser(ds, { role: 'STAFF' }));
  return repo.save(repo.create({ specialization: 'Barber', ...o, user }));
}

export async function createBooking(ds: DataSource, o: Overrides = {}) {
  const repo = ds.getRepository('Booking');
  return repo.save(
    repo.create({
      customer: o.customer ?? (await createUser(ds)),
      staff: o.staff ?? (await createStaff(ds)),
      service: o.service ?? (await createService(ds)),
      startTime: new Date('2030-01-01T10:00:00.000Z'),
      endTime: new Date('2030-01-01T10:30:00.000Z'),
      ...o,
    }),
  );
}
