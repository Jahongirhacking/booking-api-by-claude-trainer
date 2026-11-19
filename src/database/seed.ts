import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import dataSource from './data-source.config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

async function seed() {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const fullName = process.env.ADMIN_FULL_NAME || 'Administrator';

  await dataSource.initialize();
  try {
    const usersRepository = dataSource.getRepository(UserEntity);

    const existing = await usersRepository.findOne({ where: { email } });
    if (existing) {
      console.log(`Admin already exists: ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await usersRepository.save(
      usersRepository.create({
        email,
        fullName,
        passwordHash,
        role: UserRole.ADMIN,
      }),
    );
    console.log(`Admin created: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
