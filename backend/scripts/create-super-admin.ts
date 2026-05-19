import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.user.findUnique({ where: { email: 'super@edunest.dz' } });
  if (existing) {
    console.log('super_admin already exists:', existing.email);
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash('super123', 10);
  const user = await prisma.user.create({
    data: {
      schoolId: null,           // super_admin has no school
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
