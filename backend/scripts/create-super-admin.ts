import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const school = await prisma.school.findFirst();
  if (!school) {
    console.error('No school found');
    process.exit(1);
  }

  const hash = await bcrypt.hash('super123', 10);
  const user = await prisma.user.create({
    data: {
      schoolId: school.id,
      firstName: 'Super',
      lastName: 'Admin',
      email: 'super@edunest.dz',
      passwordHash: hash,
      role: 'super_admin',
      isActive: true,
      preferredLanguage: 'fr',
    },
  });

  console.log('Created super_admin:', user.email, '/ password: super123');
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
