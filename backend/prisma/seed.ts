import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

/**
 * Seeds an empty database with one school and a demo account per role.
 *
 * Usage: `npm run db:seed` (uses DATABASE_URL).
 * Set SEED_PASSWORD to give every seeded account that password instead of the
 * default `<role>123` ones — do this on any publicly reachable deployment.
 */
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Refuse to run on a database that already has data: a second run would
    // fail on duplicate emails or pile a second school on top of the first.
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      throw new Error(
        `Database already has ${existingUsers} user(s) — seed only runs on an empty database.`,
      );
    }

    console.log('🌱 Seeding database...');

    const customPassword = process.env.SEED_PASSWORD;
    const passwordFor = (role: string) => customPassword ?? `${role}123`;

    // Hash up front: bcrypt is slow and would eat into the transaction timeout.
    const [superAdminHash, adminHash, teacherHash, parentHash] = await Promise.all(
      ['superadmin', 'admin', 'teacher', 'parent'].map((role) => bcrypt.hash(passwordFor(role), 10)),
    );

    // Current school year (Sept 1 – June 30): from September on it's this
    // year's, before September it's the one that started last year.
    const now = new Date();
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const yearStart = new Date(`${startYear}-09-01`);
    const yearEnd = new Date(`${startYear + 1}-06-30`);

    // All-or-nothing, so a failure never leaves a half-seeded database.
    await prisma.$transaction(
      async (tx) => {
        // Super admin — platform-level, no school
        await tx.user.create({
          data: {
            schoolId: null,
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin@edunest.dz',
            passwordHash: superAdminHash,
            role: 'super_admin',
            isActive: true,
            preferredLanguage: 'fr',
          },
        });

        const school = await tx.school.create({
          data: {
            name: 'روضة النور / Maternelle An-Nour',
            schoolType: 'kindergarten',
            address: '12 Rue Didouche Mourad',
            wilaya: 'Alger',
            contactEmail: 'contact@annour.dz',
            contactPhone: '+213 21 00 00 00',
            isActive: true,
          },
        });
        console.log(`✅ School created: ${school.name} (${school.id})`);

        // Same default branch the payments module would auto-create on first
        // visit, so /payments is ready straight away.
        await tx.branch.create({
          data: { schoolId: school.id, name: school.name, isActive: true },
        });
        console.log('✅ Default branch created');

        await tx.user.create({
          data: {
            schoolId: school.id,
            firstName: 'Amine',
            lastName: 'Admin',
            email: 'admin@edunest.dz',
            passwordHash: adminHash,
            role: 'admin',
            isActive: true,
            preferredLanguage: 'fr',
          },
        });

        const teacher = await tx.user.create({
          data: {
            schoolId: school.id,
            firstName: 'Fatima',
            lastName: 'Enseignante',
            email: 'teacher@edunest.dz',
            passwordHash: teacherHash,
            role: 'teacher',
            isActive: true,
            preferredLanguage: 'fr',
          },
        });

        const parent = await tx.user.create({
          data: {
            schoolId: school.id,
            firstName: 'Karim',
            lastName: 'Parent',
            email: 'parent@edunest.dz',
            passwordHash: parentHash,
            role: 'parent',
            isActive: true,
            preferredLanguage: 'ar',
          },
        });
        console.log('✅ Users created');

        const academicYear = await tx.academicYear.create({
          data: {
            schoolId: school.id,
            name: `${startYear}-${startYear + 1}`,
            startDate: yearStart,
            endDate: yearEnd,
            isActive: true,
          },
        });
        console.log(`✅ Academic year created: ${academicYear.name}`);

        const classroom = await tx.classroom.create({
          data: {
            schoolId: school.id,
            academicYearId: academicYear.id,
            teacherUserId: teacher.id,
            name: 'Les Papillons',
            capacity: 25,
            roomNumber: '101',
            level: '4-5 ans',
          },
        });
        console.log(`✅ Classroom created: ${classroom.name}`);

        const child = await tx.child.create({
          data: {
            schoolId: school.id,
            academicYearId: academicYear.id,
            firstName: 'Yasmine',
            lastName: 'Parent',
            dateOfBirth: new Date('2020-03-15'),
            gender: 'female',
            enrollmentDate: yearStart,
            learnerType: 'child',
            isActive: true,
          },
        });

        await tx.classroomEnrollment.create({
          data: { childId: child.id, classroomId: classroom.id },
        });

        await tx.parentChildLink.create({
          data: {
            childId: child.id,
            parentUserId: parent.id,
            relationship: 'father',
            isPrimary: true,
          },
        });
        console.log(`✅ Child ${child.firstName} created, placed in ${classroom.name}, linked to parent`);
      },
      { timeout: 30_000 },
    );

    const shown = (role: string) => (customPassword ? '(SEED_PASSWORD)' : passwordFor(role));
    console.log('\n🎉 Seed complete! You can now sign in with:');
    console.log('─────────────────────────────────────────');
    console.log(`  Super admin: superadmin@edunest.dz / ${shown('superadmin')}`);
    console.log(`  Admin:       admin@edunest.dz       / ${shown('admin')}`);
    console.log(`  Teacher:     teacher@edunest.dz     / ${shown('teacher')}`);
    console.log(`  Parent:      parent@edunest.dz      / ${shown('parent')}`);
    console.log('─────────────────────────────────────────');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
