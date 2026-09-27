import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type BloodType, type Gender } from '@prisma/client';
import bcrypt from 'bcrypt';

/**
 * Seeds an empty database with one realistic kindergarten: staff, two
 * classes, five children (two of them siblings), parents, emergency contacts
 * and medical notes.
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
    // Birth dates are relative to the school year so ages stay right for the
    // class level whenever the seed runs.
    const bornYearsBefore = (years: number, monthDay: string) => new Date(`${startYear - years}-${monthDay}`);

    // All-or-nothing, so a failure never leaves a half-seeded database.
    await prisma.$transaction(
      async (tx) => {
        // ─── Platform ──────────────────────────────────────────────────────
        await tx.user.create({
          data: {
            schoolId: null,
            firstName: 'Samir',
            lastName: 'Hamidi',
            email: 'superadmin@edunest.dz',
            passwordHash: superAdminHash,
            role: 'super_admin',
            phone: '+213 550 10 20 30',
            preferredLanguage: 'fr',
          },
        });

        // ─── School ────────────────────────────────────────────────────────
        const school = await tx.school.create({
          data: {
            name: 'روضة النور / Maternelle An-Nour',
            schoolType: 'kindergarten',
            address: 'Cité 150 Logements, Bt 12, Bab Ezzouar',
            wilaya: 'Alger',
            contactEmail: 'contact@annour.dz',
            contactPhone: '+213 23 92 41 57',
            isActive: true,
          },
        });

        // Same default branch the payments module would auto-create on first
        // visit, so /payments is ready straight away.
        await tx.branch.create({
          data: { schoolId: school.id, name: school.name, isActive: true },
        });

        // ─── Staff ─────────────────────────────────────────────────────────
        await tx.user.create({
          data: {
            schoolId: school.id,
            firstName: 'Nadia',
            lastName: 'Benmansour',
            email: 'admin@edunest.dz',
            passwordHash: adminHash,
            role: 'admin',
            phone: '+213 550 12 34 56',
            preferredLanguage: 'fr',
          },
        });

        const teacherFatima = await tx.user.create({
          data: {
            schoolId: school.id,
            firstName: 'Fatima Zohra',
            lastName: 'Haddad',
            email: 'teacher@edunest.dz',
            passwordHash: teacherHash,
            role: 'teacher',
            phone: '+213 661 23 45 67',
            preferredLanguage: 'fr',
          },
        });

        const teacherKhadidja = await tx.user.create({
          data: {
            schoolId: school.id,
            firstName: 'Khadidja',
            lastName: 'Meziane',
            email: 'teacher2@edunest.dz',
            passwordHash: teacherHash,
            role: 'teacher',
            phone: '+213 698 45 12 30',
            preferredLanguage: 'ar',
          },
        });

        // ─── Parents ───────────────────────────────────────────────────────
        const parentKarim = await tx.user.create({
          data: {
            schoolId: school.id,
            firstName: 'Karim',
            lastName: 'Boudiaf',
            email: 'parent@edunest.dz',
            passwordHash: parentHash,
            role: 'parent',
            phone: '+213 770 98 76 54',
            address: 'Cité 1200 Logements, Bt 7, Bab Ezzouar',
            preferredLanguage: 'ar',
          },
        });

        const parentSamira = await tx.user.create({
          data: {
            schoolId: school.id,
            firstName: 'Samira',
            lastName: 'Lounis',
            email: 'parent2@edunest.dz',
            passwordHash: parentHash,
            role: 'parent',
            phone: '+213 555 67 89 01',
            address: '24 Rue des Frères Bouadou, Bir Mourad Raïs',
            preferredLanguage: 'fr',
          },
        });
        console.log('✅ School, branch, staff and parents created');

        // ─── Year & classes ────────────────────────────────────────────────
        const academicYear = await tx.academicYear.create({
          data: {
            schoolId: school.id,
            name: `${startYear}-${startYear + 1}`,
            startDate: yearStart,
            endDate: yearEnd,
            isActive: true,
          },
        });

        const papillons = await tx.classroom.create({
          data: {
            schoolId: school.id,
            academicYearId: academicYear.id,
            teacherUserId: teacherFatima.id,
            name: 'Les Papillons',
            capacity: 25,
            roomNumber: '101',
            level: '4-5 ans',
          },
        });

        const poussins = await tx.classroom.create({
          data: {
            schoolId: school.id,
            academicYearId: academicYear.id,
            teacherUserId: teacherKhadidja.id,
            name: 'Les Poussins',
            capacity: 20,
            roomNumber: '102',
            level: '3-4 ans',
          },
        });
        console.log(`✅ Academic year ${academicYear.name} with classes ${papillons.name} and ${poussins.name}`);

        // ─── Children ──────────────────────────────────────────────────────
        const createChild = async (data: {
          firstName: string;
          lastName: string;
          dateOfBirth: Date;
          gender: Gender;
          placeOfBirth: string;
          bloodType?: BloodType;
          address: string;
          classroomId: string;
        }) => {
          const { classroomId, ...fields } = data;
          const child = await tx.child.create({
            data: {
              ...fields,
              schoolId: school.id,
              academicYearId: academicYear.id,
              enrollmentDate: yearStart,
              learnerType: 'child',
            },
          });
          await tx.classroomEnrollment.create({ data: { childId: child.id, classroomId } });
          return child;
        };

        const boudiafAddress = 'Cité 1200 Logements, Bt 7, Bab Ezzouar';

        const yasmine = await createChild({
          firstName: 'Yasmine',
          lastName: 'Boudiaf',
          dateOfBirth: bornYearsBefore(5, '03-15'),
          gender: 'female',
          placeOfBirth: 'Alger',
          bloodType: 'o_positive',
          address: boudiafAddress,
          classroomId: papillons.id,
        });

        const adam = await createChild({
          firstName: 'Adam',
          lastName: 'Boudiaf',
          dateOfBirth: bornYearsBefore(4, '07-02'),
          gender: 'male',
          placeOfBirth: 'Alger',
          bloodType: 'o_positive',
          address: boudiafAddress,
          classroomId: poussins.id,
        });

        const rayan = await createChild({
          firstName: 'Rayan',
          lastName: 'Lounis',
          dateOfBirth: bornYearsBefore(5, '11-21'),
          gender: 'male',
          placeOfBirth: 'Tizi Ouzou',
          bloodType: 'a_positive',
          address: '24 Rue des Frères Bouadou, Bir Mourad Raïs',
          classroomId: papillons.id,
        });

        // No parent account yet — lets you test linking a parent later.
        await createChild({
          firstName: 'Mohamed Amine',
          lastName: 'Saidi',
          dateOfBirth: bornYearsBefore(5, '01-09'),
          gender: 'male',
          placeOfBirth: 'Blida',
          address: '5 Rue Larbi Ben M\'hidi, Dar El Beïda',
          classroomId: papillons.id,
        });

        const lina = await createChild({
          firstName: 'Lina',
          lastName: 'Cherif',
          dateOfBirth: bornYearsBefore(4, '05-30'),
          gender: 'female',
          placeOfBirth: 'Alger',
          bloodType: 'b_positive',
          address: 'Lotissement El Bina, Villa 18, Dely Brahim',
          classroomId: poussins.id,
        });

        // ─── Parent links ──────────────────────────────────────────────────
        await tx.parentChildLink.createMany({
          data: [
            { childId: yasmine.id, parentUserId: parentKarim.id, relationship: 'father', isPrimary: true },
            { childId: adam.id, parentUserId: parentKarim.id, relationship: 'father', isPrimary: true },
            { childId: rayan.id, parentUserId: parentSamira.id, relationship: 'mother', isPrimary: true },
          ],
        });

        // ─── Emergency contacts ────────────────────────────────────────────
        await tx.emergencyContact.createMany({
          data: [
            {
              childId: yasmine.id,
              name: 'Amel Boudiaf',
              relationship: 'mother',
              phone: '+213 771 22 33 44',
              address: boudiafAddress,
              isAuthorizedPickup: true,
            },
            {
              childId: yasmine.id,
              name: 'Zineb Boudiaf',
              relationship: 'grandmother',
              phone: '+213 21 24 56 78',
              address: 'Rue Hassiba Ben Bouali, Alger Centre',
              isAuthorizedPickup: true,
            },
            {
              childId: adam.id,
              name: 'Amel Boudiaf',
              relationship: 'mother',
              phone: '+213 771 22 33 44',
              address: boudiafAddress,
              isAuthorizedPickup: true,
            },
            {
              childId: rayan.id,
              name: 'Mourad Lounis',
              relationship: 'father',
              phone: '+213 662 14 25 36',
              isAuthorizedPickup: true,
            },
            {
              childId: lina.id,
              name: 'Sofiane Cherif',
              relationship: 'uncleAunt',
              phone: '+213 699 87 65 43',
              isAuthorizedPickup: false,
            },
          ],
        });

        // ─── Medical notes ─────────────────────────────────────────────────
        await tx.medicalNote.createMany({
          data: [
            {
              childId: adam.id,
              type: 'allergy',
              title: 'Allergie aux arachides',
              details: 'Éviter tout aliment contenant des cacahuètes. Stylo d\'adrénaline dans son sac.',
              severity: 'high',
            },
            {
              childId: lina.id,
              type: 'condition',
              title: 'Asthme léger',
              details: 'Ventoline en cas de gêne respiratoire après l\'effort.',
              severity: 'medium',
            },
            {
              childId: rayan.id,
              type: 'allergy',
              title: 'Intolérance au lactose',
              details: 'Lait sans lactose au goûter.',
              severity: 'low',
            },
          ],
        });
        console.log('✅ 5 children created with parent links, emergency contacts and medical notes');
      },
      { timeout: 30_000 },
    );

    const shown = (role: string) => (customPassword ? '(SEED_PASSWORD)' : passwordFor(role));
    console.log('\n🎉 Seed complete! You can now sign in with:');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`  Super admin  Samir Hamidi         superadmin@edunest.dz / ${shown('superadmin')}`);
    console.log(`  Admin        Nadia Benmansour     admin@edunest.dz      / ${shown('admin')}`);
    console.log(`  Teacher      Fatima Zohra Haddad  teacher@edunest.dz    / ${shown('teacher')}`);
    console.log(`  Teacher      Khadidja Meziane     teacher2@edunest.dz   / ${shown('teacher')}`);
    console.log(`  Parent       Karim Boudiaf        parent@edunest.dz     / ${shown('parent')}`);
    console.log(`  Parent       Samira Lounis        parent2@edunest.dz    / ${shown('parent')}`);
    console.log('──────────────────────────────────────────────────────────────');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
