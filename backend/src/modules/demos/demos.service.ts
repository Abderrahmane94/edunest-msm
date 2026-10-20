import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { DEMO_DAYS, DEMO_EMAIL_DOMAIN } from '../../lib/demo';
import { schoolYearOf } from '../../lib/school-year';
import { accessService } from '../access/access.service';
import { schoolToday } from '../admin/dashboard.service';
import { cashDesksService } from '../cash-desks/cash-desks.service';
import { enrollmentService } from '../payments/enrollment.service';
import { expenseService } from '../payments/expense.service';
import { paymentService } from '../payments/payments.service';
import { temporaryPassword } from '../users/users.service';
import { cloudinaryService } from '../../services/cloudinary.service';
import { activityPicture, portrait } from './demo-pictures';

export class DemoServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DemoServiceError';
  }
}

export interface CreateDemoInput {
  firstName: string;
  lastName: string;
  phone: string;
  /** The name the demonstration school takes; by default "Crèche démo". */
  schoolName?: string;
  language: 'fr' | 'ar';
}

export interface DemoAccounts {
  director: string;
  teacher: string;
  parent: string;
}

export interface CreatedDemo {
  schoolId: string;
  schoolName: string;
  expiresAt: string;
  phone: string;
  firstName: string;
  language: 'fr' | 'ar';
  accounts: DemoAccounts;
  /** The same for the three accounts, told once. */
  password: string;
}

export interface DemoRow {
  schoolId: string;
  schoolName: string;
  directorName: string;
  phone: string;
  createdAt: string;
  expiresAt: string;
  /** Last time someone of the demonstration used it; null: never signed in. */
  lastActiveAt: string | null;
}

// ─── Small helpers (all days are "YYYY-MM-DD", the school's calendar) ─────────

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);
const addDays = (d: string, n: number) => {
  const x = day(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const maxDay = (a: string, b: string) => (a > b ? a : b);

/** Runs `fn` on every item, `size` at a time. */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/** Repeatable randomness for one demonstration: the same picks in the same order. */
function randomFrom(seed: string) {
  let state = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0) || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)],
  };
}

// ─── The fictitious school ───────────────────────────────────────────────────

const TEXT = {
  fr: {
    school: 'Crèche démo',
    classes: [
      { name: 'Les Poussins', level: 'Petite section', age: 3, room: 'Salle Soleil', color: 'amber' },
      { name: 'Les Papillons', level: 'Moyenne section', age: 4, room: 'Salle Lune', color: 'sky' },
      { name: 'Les Explorateurs', level: 'Grande section', age: 5, room: 'Salle Étoile', color: 'emerald' },
    ],
    registration: "Frais d'inscription",
    monthly: 'Mensualité',
    expenses: [
      ['supplies', 'Peinture et feutres', 6400],
      ['food', 'Goûters de la semaine', 12800],
      ['utilities', 'Facture électricité', 9300],
      ['maintenance', 'Réparation robinet', 3500],
      ['supplies', 'Couches et lingettes', 8700],
      ['food', 'Fruits et lait', 11200],
      ['transport', 'Sortie au jardin (bus)', 15000],
      ['other', 'Impression des carnets', 4200],
    ] as const,
    announcements: [
      ['Réunion des parents', 'Une réunion avec les parents aura lieu jeudi à 16h30 pour présenter le programme du trimestre. Nous comptons sur votre présence.'],
      ['Sortie au jardin', 'Les enfants iront au jardin public la semaine prochaine. Pensez à leur mettre une casquette et une bouteille d’eau.'],
    ] as const,
    medical: [
      ['allergy', 'Allergie aux arachides', 'Aucun aliment contenant des cacahuètes.', 'high'],
      ['condition', 'Asthme léger', 'Ventoline dans le sac en cas de besoin.', 'medium'],
      ['allergy', 'Intolérance au lactose', 'Lait sans lactose fourni par les parents.', 'low'],
    ] as const,
    notes: { late: 'Arrivé avec sa maman à 9h15', absent: 'Malade, prévenu par téléphone' },
    ccp: 'Virement CCP — reçu n° ',
    activities: ['Peinture avec les doigts et chansons', 'Pâte à modeler, puis jeux dans la cour', 'Histoire racontée et coloriage', 'Atelier gommettes et comptines', 'Jeux de construction et danse'],
    reportNote: 'Très bonne journée, a bien participé.',
    baridimob: 'BaridiMob — réf. ',
    secretary: ['Samia', 'Kaci'],
  },
  ar: {
    school: 'روضة تجريبية',
    classes: [
      { name: 'الكتاكيت', level: 'القسم الصغير', age: 3, room: 'قاعة الشمس', color: 'amber' },
      { name: 'الفراشات', level: 'القسم المتوسط', age: 4, room: 'قاعة القمر', color: 'sky' },
      { name: 'المستكشفون', level: 'القسم التحضيري', age: 5, room: 'قاعة النجمة', color: 'emerald' },
    ],
    registration: 'حقوق التسجيل',
    monthly: 'الاشتراك الشهري',
    expenses: [
      ['supplies', 'ألوان وأقلام', 6400],
      ['food', 'لمجة الأسبوع', 12800],
      ['utilities', 'فاتورة الكهرباء', 9300],
      ['maintenance', 'تصليح حنفية', 3500],
      ['supplies', 'حفاظات ومناديل', 8700],
      ['food', 'فواكه وحليب', 11200],
      ['transport', 'خرجة إلى الحديقة (حافلة)', 15000],
      ['other', 'طباعة الدفاتر', 4200],
    ] as const,
    announcements: [
      ['اجتماع الأولياء', 'سيُعقد اجتماع مع الأولياء يوم الخميس على الساعة 16:30 لتقديم برنامج الفصل. نرجو حضوركم.'],
      ['خرجة إلى الحديقة', 'سيخرج الأطفال إلى الحديقة العمومية الأسبوع القادم. لا تنسوا القبعة وقارورة الماء.'],
    ] as const,
    medical: [
      ['allergy', 'حساسية من الفول السوداني', 'لا يُقدَّم له أي طعام يحتوي على الفول السوداني.', 'high'],
      ['condition', 'ربو خفيف', 'بخاخ في الحقيبة عند الحاجة.', 'medium'],
      ['allergy', 'عدم تحمل اللاكتوز', 'حليب بدون لاكتوز يحضره الأولياء.', 'low'],
    ] as const,
    notes: { late: 'وصل مع أمه على 9:15', absent: 'مريض، اتصل الأولياء' },
    ccp: 'تحويل CCP — وصل رقم ',
    activities: ['رسم بالأصابع وأناشيد', 'عجينة التشكيل ثم اللعب في الساحة', 'قصة وتلوين', 'ورشة ملصقات وأناشيد', 'ألعاب البناء ورقص'],
    reportNote: 'يوم جميل جداً، شارك بنشاط.',
    baridimob: 'بريدي موب — مرجع ',
    secretary: ['سامية', 'قاسي'],
  },
};

const BOYS = ['Yanis', 'Adam', 'Rayan', 'Ilyes', 'Amir', 'Wassim', 'Anis', 'Mehdi', 'Ayoub', 'Younes', 'Nassim', 'Zakaria'];
const GIRLS = ['Lina', 'Sara', 'Maria', 'Inès', 'Malak', 'Assia', 'Nour', 'Aya', 'Meriem', 'Hiba', 'Rania', 'Lyna'];
const FAMILIES = ['Benali', 'Bouzid', 'Haddad', 'Mansouri', 'Belkacem', 'Cherif', 'Rahmani', 'Saidi', 'Ait Ahmed', 'Hamidi', 'Djebbar', 'Meziane', 'Ouali', 'Ferhat', 'Boudiaf', 'Larbi', 'Zerrouki', 'Toumi', 'Amrani', 'Kaddour', 'Brahimi', 'Slimani'];
const MOTHERS = ['Amina', 'Karima', 'Nadia', 'Souad', 'Fatiha', 'Leila', 'Samira', 'Yasmine', 'Houda', 'Wafa'];
const FATHERS = ['Karim', 'Sofiane', 'Mourad', 'Rachid', 'Farid', 'Hakim', 'Nabil', 'Djamel', 'Samir', 'Riad'];
const TEACHERS = [['Fatima', 'Zohra'], ['Imane', 'Belhadj'], ['Khadidja', 'Mokrani']] as const;
const CHILDREN_PER_CLASS = 8;

/** A phone number that is nobody's (an unassigned 0500 range). */
const fakePhone = (n: number) => `0500 00 ${String(Math.floor(n / 100) % 100).padStart(2, '0')} ${String(n % 100).padStart(2, '0')}`;

class DemosService {
  /**
   * A demonstration school for one director: its own accounts (director,
   * teacher, parent) and weeks of fictitious life (classes, children,
   * attendance, payments, late families, expenses, announcements), dated from
   * the start of the school year to today. Nobody else's data is touched; it
   * closes after DEMO_DAYS days.
   */
  async create(input: CreateDemoInput): Promise<CreatedDemo> {
    const T = TEXT[input.language];
    const today = schoolToday();
    const year = schoolYearOf(today);
    // The weeks the school has been running: from the year's start, at least three weeks back.
    const opened = year.startDate < addDays(today, -21) ? year.startDate : addDays(today, -21);
    const code = crypto.randomBytes(3).toString('hex').slice(0, 4);
    const rnd = randomFrom(code);
    const password = temporaryPassword();
    const login = (who: string) => `${who}.${code}@${DEMO_EMAIL_DOMAIN}`;
    const accounts: DemoAccounts = { director: login('directeur'), teacher: login('enseignant'), parent: login('parent') };
    const expiresAt = new Date(Date.now() + DEMO_DAYS * 24 * 60 * 60 * 1000);
    const schoolName = input.schoolName?.trim() || T.school;

    // Hashed before the transaction: bcrypt is slow. Fictitious people get a password nobody knows.
    const [passwordHash, nobodyHash] = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(crypto.randomBytes(18).toString('base64'), 10),
    ]);

    const built = await prisma.$transaction(
      async (tx) => {
        const school = await tx.school.create({
          data: {
            name: schoolName,
            schoolType: 'kindergarten',
            address: input.language === 'ar' ? 'حي النصر، الجزائر' : 'Cité El Nasr, Alger',
            wilaya: 'Alger',
            contactEmail: `contact.${code}@${DEMO_EMAIL_DOMAIN}`,
            contactPhone: input.phone,
            demoExpiresAt: expiresAt,
          },
        });
        await accessService.ensureDefault(school.id, tx);
        const academicYear = await tx.academicYear.create({
          data: { schoolId: school.id, name: year.name, startDate: day(year.startDate), endDate: day(year.endDate), isActive: true },
        });
        const branch = await tx.branch.create({ data: { schoolId: school.id, name: schoolName, isActive: true } });
        await tx.branchBillingConfig.create({ data: { branchId: branch.id } });

        const person = (data: { firstName: string; lastName: string; role: 'admin' | 'administrative' | 'teacher' | 'parent'; email: string; hash: string }) =>
          tx.user.create({
            data: {
              schoolId: school.id,
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              phone: null,
              passwordHash: data.hash,
              role: data.role,
              preferredLanguage: input.language,
              isActive: true,
              mustChangePassword: false,
            },
          });

        const director = await person({ firstName: input.firstName, lastName: input.lastName, role: 'admin', email: accounts.director, hash: passwordHash });
        const secretary = await person({ firstName: T.secretary[0], lastName: T.secretary[1], role: 'administrative', email: login(`secretariat`), hash: nobodyHash });
        const teachers = await Promise.all(
          TEACHERS.map(([firstName, lastName], i) =>
            person({ firstName, lastName, role: 'teacher', email: i === 0 ? accounts.teacher : login(`enseignant${i + 1}`), hash: i === 0 ? passwordHash : nobodyHash }),
          ),
        );

        // Fees billed to every child: the registration once, then each month (due the 5th, 5 days' grace).
        await tx.branchFee.create({
          data: { branchId: branch.id, name: T.registration, amount: new Prisma.Decimal(5000), appliesToSchool: true },
        });
        await tx.branchFee.create({
          data: {
            branchId: branch.id,
            name: T.monthly,
            amount: new Prisma.Decimal(15000),
            billingCycle: 'monthly',
            billingDueDay: 5,
            gracePeriodDays: 5,
            appliesToSchool: true,
          },
        });

        // Rooms and classes, a teacher each.
        const classes = [];
        for (const [i, c] of T.classes.entries()) {
          const room = await tx.room.create({ data: { schoolId: school.id, name: c.room, capacity: 12 } });
          const classroom = await tx.classroom.create({
            data: {
              schoolId: school.id,
              academicYearId: academicYear.id,
              teacherUserId: teachers[i].id,
              name: c.name,
              level: c.level,
              capacity: 12,
              roomId: room.id,
              color: c.color,
            },
          });
          classes.push({ ...c, id: classroom.id, teacherId: teachers[i].id });
        }

        // Children, their family, their file.
        const children: { id: string; girl: boolean; classroomId: string; teacherId: string; start: string; profile: 'good' | 'late' | 'none' }[] = [];
        let n = 0;
        let demoParentId: string | null = null;
        for (const c of classes) {
          for (let k = 0; k < CHILDREN_PER_CLASS; k++, n++) {
            const girl = n % 2 === 1;
            // The demonstration parent's two children (n = 0, 1) are siblings.
            const lastName = FAMILIES[n === 1 ? 0 : n % FAMILIES.length];
            // Most started with the school; the last of each class joined later.
            const start = k === CHILDREN_PER_CLASS - 1 ? addDays(today, -rnd.int(3, 12)) : k === CHILDREN_PER_CLASS - 2 ? addDays(opened, 14) : opened;
            const born = `${Number(year.startDate.slice(0, 4)) - c.age}-${String(rnd.int(1, 12)).padStart(2, '0')}-${String(rnd.int(1, 28)).padStart(2, '0')}`;
            const child = await tx.child.create({
              data: {
                schoolId: school.id,
                academicYearId: academicYear.id,
                firstName: girl ? GIRLS[n % GIRLS.length] : BOYS[n % BOYS.length],
                lastName,
                dateOfBirth: day(born),
                gender: girl ? 'female' : 'male',
                enrollmentDate: day(start),
              },
            });
            await tx.classroomEnrollment.create({ data: { childId: child.id, classroomId: c.id, enrolledAt: day(start) } });

            // The demonstration's parent has two children here (the first two of the first class).
            let parentId: string;
            if (n === 1 && demoParentId) {
              parentId = demoParentId;
            } else {
              const mother = MOTHERS[n % MOTHERS.length];
              const parent = await person({ firstName: mother, lastName, role: 'parent', email: n === 0 ? accounts.parent : login(`parent${n + 1}`), hash: n === 0 ? passwordHash : nobodyHash });
              parentId = parent.id;
              if (n === 0) demoParentId = parent.id;
            }
            await tx.parentChildLink.create({ data: { childId: child.id, parentUserId: parentId, relationship: 'mother', isPrimary: true } });
            await tx.emergencyContact.create({
              data: { childId: child.id, name: `${FATHERS[n % FATHERS.length]} ${lastName}`, relationship: 'father', phone: fakePhone(n + 1), isAuthorizedPickup: true },
            });
            if (n % 9 === 2) {
              const [type, title, details, severity] = T.medical[Math.floor(n / 9) % T.medical.length];
              await tx.medicalNote.create({ data: { childId: child.id, type, title, details, severity } });
            }

            // Billed from its first day, with the school's fees.
            const enrollment = await enrollmentService.createInTransaction(tx, {
              childId: child.id,
              branchId: branch.id,
              academicYearId: academicYear.id,
              startDate: day(start),
              feeIds: [],
            });
            // The registration fee was due the day it started, not the day the demonstration was made.
            await tx.billingPeriod.updateMany({
              where: { enrollmentId: enrollment.enrollmentId, isRegistrationPeriod: false, branchFee: { billingCycle: null } },
              data: { periodStart: day(start), periodEnd: day(start), dueDate: day(start), graceEndDate: day(addDays(start, 5)) },
            });

            const r = rnd.next();
            children.push({ id: child.id, girl, classroomId: c.id, teacherId: c.teacherId, start, profile: r < 0.65 ? 'good' : r < 0.9 ? 'late' : 'none' });
          }
        }

        // The roll call of each school day until yesterday (today's is for the visitor to take).
        const records: Prisma.AttendanceRecordCreateManyInput[] = [];
        const changes: Prisma.AttendanceChangeCreateManyInput[] = [];
        const teacherName = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));
        for (let d = addDays(today, -21); d < today; d = addDays(d, 1)) {
          const weekday = day(d).getUTCDay();
          if (weekday === 5 || weekday === 6) continue; // Friday, Saturday
          for (const child of children) {
            if (d < child.start) continue;
            const r = rnd.next();
            const status = r < 0.86 ? 'present' : r < 0.94 ? 'absent' : 'late';
            const note = status === 'late' ? T.notes.late : status === 'absent' && rnd.next() < 0.5 ? T.notes.absent : null;
            const id = crypto.randomUUID();
            const markedAt = new Date(`${d}T07:${String(rnd.int(40, 59)).padStart(2, '0')}:00.000Z`);
            records.push({ id, schoolId: school.id, childId: child.id, classroomId: child.classroomId, date: day(d), status, note, markedByUserId: child.teacherId, createdAt: markedAt, updatedAt: markedAt });
            changes.push({
              recordId: id, schoolId: school.id, childId: child.id, classroomId: child.classroomId, date: day(d),
              toStatus: status, toNote: note, byUserId: child.teacherId, byName: teacherName.get(child.teacherId) ?? '', source: 'teacher', createdAt: markedAt,
            });
          }
        }
        await tx.attendanceRecord.createMany({ data: records });
        await tx.attendanceChange.createMany({ data: changes });

        // The teachers' daily reports for the last five school days: what parents open first.
        const reportDays = [...new Set(records.map((r) => iso(r.date as Date)))].sort().slice(-5);
        const moods = ['happy', 'happy', 'calm', 'excited', 'tired'] as const;
        await tx.dailyReport.createMany({
          data: records
            .filter((r) => r.status !== 'absent' && reportDays.includes(iso(r.date as Date)))
            .map((r) => ({
              schoolId: school.id,
              childId: r.childId,
              date: r.date,
              mood: rnd.pick(moods),
              mealsEaten: rnd.int(2, 3),
              napDurationMinutes: rnd.int(4, 9) * 10,
              activities: T.activities[reportDays.indexOf(iso(r.date as Date)) % T.activities.length],
              generalNote: rnd.next() < 0.3 ? T.reportNote : null,
              createdByUserId: r.markedByUserId,
              createdAt: new Date(`${iso(r.date as Date)}T15:${String(rnd.int(0, 45)).padStart(2, '0')}:00.000Z`),
            })),
        });

        // News from the office.
        for (const [i, [title, content]] of T.announcements.entries()) {
          await tx.announcement.create({
            data: { schoolId: school.id, title, content, createdByUserId: director.id, publishedAt: day(addDays(today, -(i * 6 + 2))) },
          });
        }

        return { school, branch, academicYear, director, secretary, children };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    await this.fillMoney(built, T, rnd, today, opened);
    await this.addPictures(built, T, rnd, `${input.firstName} ${input.lastName}`.trim());

    return {
      schoolId: built.school.id,
      schoolName,
      expiresAt: expiresAt.toISOString(),
      phone: input.phone,
      firstName: input.firstName,
      language: input.language,
      accounts,
      password,
    };
  }

  /**
   * The money side, through the same services as the office uses: who paid
   * what and when (some families late), last month's cash handed over, this
   * month's still in the desk, and the expenses.
   */
  private async fillMoney(
    built: {
      school: { id: string };
      branch: { id: string };
      director: { id: string };
      secretary: { id: string };
      children: { id: string; start: string; profile: 'good' | 'late' | 'none' }[];
    },
    T: (typeof TEXT)[keyof typeof TEXT],
    rnd: ReturnType<typeof randomFrom>,
    today: string,
    opened: string,
  ): Promise<void> {
    const monthStart = `${today.slice(0, 7)}-01`;
    const payments: { childId: string; date: string; periods: { id: string; amount: Prisma.Decimal }[] }[] = [];

    for (const child of built.children) {
      const periods = await prisma.billingPeriod.findMany({
        where: { enrollment: { childId: child.id }, cancelledAt: null, periodStart: { lte: day(today) } },
        orderBy: [{ periodStart: 'asc' }, { isRegistrationPeriod: 'desc' }],
        select: { id: true, periodStart: true, amountDue: true, branchFee: { select: { billingCycle: true } } },
      });
      const oneOff = periods.filter((p) => !p.branchFee?.billingCycle);
      const months = periods.filter((p) => p.branchFee?.billingCycle);
      // The latest month is still owed by late families; the others paid only their first.
      const paidMonths = child.profile === 'good' ? months : child.profile === 'late' ? months.slice(0, -1) : months.slice(0, 1);
      paidMonths.forEach((p, i) => {
        const date = maxDay(child.start, iso(p.periodStart));
        const when = addDays(date, rnd.int(0, 6));
        payments.push({
          childId: child.id,
          date: when > today ? today : when,
          periods: [...(i === 0 ? oneOff : []), p].map((x) => ({ id: x.id, amount: x.amountDue })),
        });
      });
    }

    payments.sort((a, b) => a.date.localeCompare(b.date));
    let handedOver = false;
    for (const p of payments) {
      // Before this month: the secretary's cash was handed over to the director.
      if (!handedOver && p.date >= monthStart) {
        await this.handOverSecretaryCash(built);
        handedOver = true;
      }
      const r = rnd.next();
      const channel = r < 0.55 ? 'cash' : r < 0.85 ? 'ccp' : 'baridimob';
      const total = p.periods.reduce((s, x) => s.add(x.amount), new Prisma.Decimal(0));
      if (total.lte(0)) continue;
      await paymentService.recordPayment(
        {
          childId: p.childId,
          totalAmount: total,
          channel,
          valueDate: day(p.date),
          recordedBy: channel === 'cash' ? built.secretary.id : built.director.id,
          referenceNote: channel === 'ccp' ? `${T.ccp}${rnd.int(1000, 9999)}` : channel === 'baridimob' ? `${T.baridimob}${rnd.int(100000, 999999)}` : undefined,
          isCorrection: false,
          allocations: p.periods.filter((x) => x.amount.gt(0)).map((x) => ({ billingPeriodId: x.id, amount: x.amount })),
        },
        built.branch.id,
      );
    }
    if (!handedOver) await this.handOverSecretaryCash(built);

    // What the school spent since it opened.
    const span = Math.max(1, Math.round((day(today).getTime() - day(opened).getTime()) / 86_400_000));
    for (const [i, [category, description, amount]] of T.expenses.entries()) {
      await expenseService.create(
        built.school.id,
        { category, description, amount, currency: 'DZD', date: addDays(opened, Math.floor((span * (i + 0.5)) / T.expenses.length)) },
        built.director.id,
      );
    }
  }

  /**
   * Drawn pictures (no real child): a portrait for every child, its parents'
   * agreement given, and a picture of the day's activity on the reports of the
   * demonstration parent's two children. Decoration only: if storing them
   * fails, the demonstration stays as it is, with initials.
   */
  private async addPictures(
    built: { school: { id: string }; director: { id: string }; children: { id: string; girl: boolean }[] },
    T: (typeof TEXT)[keyof typeof TEXT],
    rnd: ReturnType<typeof randomFrom>,
    directorName: string,
  ) {
    const store = (body: string, folder: string) =>
      cloudinaryService.uploadFile(Buffer.from(body), {
        folder: `schools/${built.school.id}/${folder}`,
        resourceType: 'image',
        accessMode: 'authenticated',
        extension: 'svg',
        mimeType: 'image/svg+xml',
      });
    try {
      // Drawn in order (the same demonstration, the same faces), sent a few at a time.
      const portraits = built.children.map((c) => ({ id: c.id, body: portrait(c.girl, rnd.pick) }));
      await inBatches(portraits, 6, async ({ id, body }) => {
        const { publicId } = await store(body, 'children');
        await prisma.child.update({
          where: { id },
          data: { photoPublicId: publicId, photoConsentAt: new Date(), photoConsentById: built.director.id, photoConsentByName: directorName },
        });
      });
      const reports = await prisma.dailyReport.findMany({
        where: { childId: { in: built.children.slice(0, 2).map((c) => c.id) } },
        select: { id: true, activities: true },
      });
      const pictures = reports.map((r) => ({ id: r.id, body: activityPicture(Math.max(0, T.activities.indexOf(r.activities ?? '')), rnd.pick) }));
      await inBatches(pictures, 6, async ({ id, body }) => {
        const { publicId } = await store(body, 'daily-reports');
        await prisma.dailyReportPhoto.create({ data: { dailyReportId: id, cloudinaryPublicId: publicId } });
      });
    } catch (error) {
      console.error('[Demos] Pictures not all stored:', error);
    }
  }

  /** The director collects what the secretary took in cash so far (nothing missing). */
  private async handOverSecretaryCash(built: { school: { id: string }; director: { id: string }; secretary: { id: string } }) {
    const desk = await cashDesksService.desk(built.secretary.id, built.school.id);
    const expected = Number(desk.expected);
    if (!(expected > 0)) return;
    await cashDesksService.collect(
      { userId: built.director.id, role: 'admin', schoolId: built.school.id },
      built.secretary.id,
      { countedAmount: expected, floatLeft: 0, expectedAmount: expected },
    );
  }

  /** The demonstrations still open, newest first; those past their end are closed on the way. */
  async list(): Promise<DemoRow[]> {
    await this.closeEnded();
    const schools = await prisma.school.findMany({
      where: { demoExpiresAt: { not: null }, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        contactPhone: true,
        createdAt: true,
        demoExpiresAt: true,
        users: { where: { role: 'admin' }, select: { firstName: true, lastName: true }, take: 1 },
      },
    });
    const active = await prisma.user.groupBy({
      by: ['schoolId'],
      where: { schoolId: { in: schools.map((s) => s.id) }, deletedAt: null },
      _max: { lastActiveAt: true },
    });
    const lastOf = new Map(active.map((a) => [a.schoolId, a._max.lastActiveAt]));
    return schools.map((s) => ({
      schoolId: s.id,
      schoolName: s.name,
      directorName: s.users[0] ? `${s.users[0].firstName} ${s.users[0].lastName}`.trim() : '',
      phone: s.contactPhone,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.demoExpiresAt!.toISOString(),
      lastActiveAt: lastOf.get(s.id)?.toISOString() ?? null,
    }));
  }

  /** A few more days for a director still trying. */
  async extend(schoolId: string, days: number): Promise<{ expiresAt: string }> {
    const school = await this.find(schoolId);
    const from = Math.max(Date.now(), school.demoExpiresAt!.getTime());
    const expiresAt = new Date(from + days * 24 * 60 * 60 * 1000);
    await prisma.school.update({ where: { id: schoolId }, data: { demoExpiresAt: expiresAt } });
    return { expiresAt: expiresAt.toISOString() };
  }

  /** Closes a demonstration now: nobody can sign in to it any more, and it leaves the lists. */
  async end(schoolId: string): Promise<void> {
    await this.find(schoolId);
    const now = new Date();
    await prisma.$transaction([
      prisma.school.update({ where: { id: schoolId }, data: { isActive: false, deletedAt: now, demoExpiresAt: now } }),
      prisma.user.updateMany({ where: { schoolId }, data: { isActive: false } }),
    ]);
  }

  /** Demonstrations past their end: closed and removed from the lists (their sign-ins already refused). */
  async closeEnded(): Promise<number> {
    const ended = await prisma.school.findMany({ where: { demoExpiresAt: { lte: new Date() }, isActive: true }, select: { id: true } });
    if (!ended.length) return 0;
    const ids = ended.map((s) => s.id);
    await prisma.$transaction([
      prisma.school.updateMany({ where: { id: { in: ids } }, data: { isActive: false, deletedAt: new Date() } }),
      prisma.user.updateMany({ where: { schoolId: { in: ids } }, data: { isActive: false } }),
    ]);
    return ids.length;
  }

  private async find(schoolId: string) {
    const school = await prisma.school.findFirst({ where: { id: schoolId, demoExpiresAt: { not: null }, isActive: true } });
    if (!school) throw new DemoServiceError('Demonstration not found', 404);
    return school;
  }
}

export const demosService = new DemosService();
