import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Seeding multi-child scenario...\n');

  // Get existing school and academic year
  const school = await prisma.school.findFirst();
  if (!school) { console.error('No school found'); process.exit(1); }

  const academicYear = await prisma.academicYear.findFirst({ where: { schoolId: school.id, isActive: true } });
  if (!academicYear) { console.error('No active academic year'); process.exit(1); }

  // Get existing parent (Karim)
  const parent = await prisma.user.findFirst({ where: { email: 'parent@edunest.dz' } });
  if (!parent) { console.error('Parent not found'); process.exit(1); }

  // 1. Create a second teacher
  const teacher2Hash = await bcrypt.hash('teacher2pass', 10);
  const teacher2 = await prisma.user.create({
    data: {
      schoolId: school.id,
      firstName: 'Omar',
      lastName: 'Professeur',
      email: 'teacher2@edunest.dz',
      passwordHash: teacher2Hash,
      role: 'teacher',
      isActive: true,
      preferredLanguage: 'fr',
    },
  });
  console.log(`✅ Teacher 2 created: ${teacher2.email} / teacher2pass`);

  // 2. Create a second classroom assigned to teacher2
  const classroom2 = await prisma.classroom.create({
    data: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      teacherUserId: teacher2.id,
      name: 'Les Étoiles',
      capacity: 20,
      roomNumber: '102',
      level: '3-4 ans',
    },
  });
  console.log(`✅ Classroom 2 created: ${classroom2.name}`);

  // 3. Create a second child
  const child2 = await prisma.child.create({
    data: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      firstName: 'Ahmed',
      lastName: 'Parent',
      dateOfBirth: new Date('2021-07-20'),
      gender: 'male',
      enrollmentDate: new Date('2025-09-01'),
      learnerType: 'child',
      isActive: true,
    },
  });
  console.log(`✅ Child 2 created: ${child2.firstName} ${child2.lastName}`);

  // 4. Enroll child2 in classroom2
  await prisma.classroomEnrollment.create({
    data: { childId: child2.id, classroomId: classroom2.id },
  });
  console.log(`✅ ${child2.firstName} enrolled in ${classroom2.name}`);

  // 5. Link the same parent (Karim) to child2
  await prisma.parentChildLink.create({
    data: {
      childId: child2.id,
      parentUserId: parent.id,
      relationship: 'father',
      isPrimary: true,
    },
  });
  console.log(`✅ Parent Karim linked to ${child2.firstName}`);

  // 6. Create a conversation between teacher2 and parent about child2
  const conversation = await prisma.conversation.create({
    data: {
      schoolId: school.id,
      childId: child2.id,
      teacherUserId: teacher2.id,
      parentUserId: parent.id,
      lastMessageAt: new Date(),
    },
  });
  console.log(`✅ Conversation created between Omar and Karim about Ahmed`);

  // 7. Send a message from teacher2 to parent
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderUserId: teacher2.id,
      content: 'Bonjour Karim! Ahmed s\'adapte très bien à la classe. Il est très sociable.',
      messageType: 'text',
      isRead: false,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });
  console.log(`✅ Message sent from Omar to Karim about Ahmed`);

  // 8. Create a daily report for child2
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.dailyReport.create({
    data: {
      schoolId: school.id,
      childId: child2.id,
      date: today,
      mood: 'excited',
      mealsEaten: 3,
      napDurationMinutes: 45,
      activities: 'Peinture, jeux de construction, comptines',
      generalNote: 'Ahmed a été très enthousiaste aujourd\'hui. Il a partagé ses jouets avec les autres.',
      createdByUserId: teacher2.id,
    },
  });
  console.log(`✅ Daily report created for Ahmed (mood: excited, 3 meals, 45min nap)`);

  // 9. Mark attendance for child2 (present today)
  await prisma.attendanceRecord.create({
    data: {
      schoolId: school.id,
      childId: child2.id,
      classroomId: classroom2.id,
      date: today,
      status: 'present',
      markedByUserId: teacher2.id,
    },
  });
  console.log(`✅ Attendance marked for Ahmed: present`);

  console.log('\n🎉 Multi-child scenario seeded!');
  console.log('─────────────────────────────────────────');
  console.log('  Parent Karim now has 2 children:');
  console.log('    - Yasmine (Les Papillons, teacher: Fatima)');
  console.log('    - Ahmed (Les Étoiles, teacher: Omar)');
  console.log('');
  console.log('  New teacher: teacher2@edunest.dz / teacher2pass');
  console.log('─────────────────────────────────────────');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); });
