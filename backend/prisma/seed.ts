import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Seeding database...');

  // Create super admin user (password: superadmin123) — platform-level, no school
  const superAdminPasswordHash = await bcrypt.hash('superadmin123', 10);
  const superAdmin = await prisma.user.create({
    data: {
      schoolId: null,
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@edunest.dz',
      passwordHash: superAdminPasswordHash,
      role: 'super_admin',
      isActive: true,
      preferredLanguage: 'fr',
    },
  });
  console.log(`✅ Super admin user created: ${superAdmin.email}`);

  // Create a school
  const school = await prisma.school.create({
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

  // Create admin user (password: admin123)
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      schoolId: school.id,
      firstName: 'Amine',
      lastName: 'Admin',
      email: 'admin@edunest.dz',
      passwordHash: adminPasswordHash,
      role: 'admin',
      isActive: true,
      preferredLanguage: 'fr',
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // Create teacher user (password: teacher123)
  const teacherPasswordHash = await bcrypt.hash('teacher123', 10);
  const teacher = await prisma.user.create({
    data: {
      schoolId: school.id,
      firstName: 'Fatima',
      lastName: 'Enseignante',
      email: 'teacher@edunest.dz',
      passwordHash: teacherPasswordHash,
      role: 'teacher',
      isActive: true,
      preferredLanguage: 'fr',
    },
  });
  console.log(`✅ Teacher user created: ${teacher.email}`);

  // Create parent user (password: parent123)
  const parentPasswordHash = await bcrypt.hash('parent123', 10);
  const parent = await prisma.user.create({
    data: {
      schoolId: school.id,
      firstName: 'Karim',
      lastName: 'Parent',
      email: 'parent@edunest.dz',
      passwordHash: parentPasswordHash,
      role: 'parent',
      isActive: true,
      preferredLanguage: 'ar',
    },
  });
  console.log(`✅ Parent user created: ${parent.email}`);

  // Create an academic year
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    },
  });
  console.log(`✅ Academic year created: ${academicYear.name}`);

  // Create a classroom
  const classroom = await prisma.classroom.create({
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

  // Create a child
  const child = await prisma.child.create({
    data: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      firstName: 'Yasmine',
      lastName: 'Parent',
      dateOfBirth: new Date('2020-03-15'),
      gender: 'female',
      enrollmentDate: new Date('2025-09-01'),
      learnerType: 'child',
      isActive: true,
    },
  });
  console.log(`✅ Child created: ${child.firstName} ${child.lastName}`);

  // Enroll child in classroom
  await prisma.classroomEnrollment.create({
    data: {
      childId: child.id,
      classroomId: classroom.id,
    },
  });
  console.log(`✅ Child enrolled in ${classroom.name}`);

  // Link parent to child
  await prisma.parentChildLink.create({
    data: {
      childId: child.id,
      parentUserId: parent.id,
      relationship: 'father',
      isPrimary: true,
    },
  });
  console.log(`✅ Parent linked to child`);

  console.log('\n🎉 Seed complete! You can now sign in with:');
  console.log('─────────────────────────────────────────');
  console.log('  Super admin: superadmin@edunest.dz / superadmin123');
  console.log('  Admin:       admin@edunest.dz       / admin123');
  console.log('  Teacher:     teacher@edunest.dz     / teacher123');
  console.log('  Parent:      parent@edunest.dz      / parent123');
  console.log('─────────────────────────────────────────');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
