import { describe, it, expect } from 'vitest';
import { birthDateSchema, isoDateSchema, latestToday, pastDateSchema, personNameSchema, phoneSchema } from './validators';
import { createChildSchema, updateChildSchema } from '../modules/children/children.schema';
import { createStaffProfileSchema } from '../modules/staff/staff.schema';
import { createClassroomSchema } from '../modules/classrooms/classrooms.schema';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success;
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

describe('what a form may send', () => {
  it('takes real days only', () => {
    expect(ok(isoDateSchema, '2024-02-29')).toBe(true);
    expect(ok(isoDateSchema, '2025-02-31')).toBe(false);
    expect(ok(isoDateSchema, '2025-13-01')).toBe(false);
    expect(ok(isoDateSchema, '0202-05-01')).toBe(false);
    expect(ok(isoDateSchema, '20250501')).toBe(false);
  });

  it('refuses a day to come where the thing is done', () => {
    expect(ok(pastDateSchema, latestToday())).toBe(true);
    expect(ok(pastDateSchema, day(-30))).toBe(true);
    expect(ok(pastDateSchema, day(3))).toBe(false);
  });

  it('takes a birth date from today back to a school age', () => {
    expect(ok(birthDateSchema, day(-1))).toBe(true);
    expect(ok(birthDateSchema, day(-365 * 5))).toBe(true);
    expect(ok(birthDateSchema, day(30))).toBe(false);
    expect(ok(birthDateSchema, '1990-01-01')).toBe(false);
  });

  it('takes names in any alphabet, with at least two letters and no digits', () => {
    for (const name of ['Amine', 'Ben Ali', "N'Diaye", 'Jean-Luc', 'أمين', 'عبد الرحمن', 'Zoé', '  Lina ']) expect(ok(personNameSchema(), name), name).toBe(true);
    for (const name of ['', ' ', 'B', 'A.', 'Lina2', '123', '-Ali', '@li']) expect(ok(personNameSchema(), name), name).toBe(false);
    expect(personNameSchema().parse('  Lina ')).toBe('Lina');
  });

  it('takes phone numbers, not text', () => {
    for (const phone of ['0555123456', '+213 555 12 34 56', '(021) 23-45-67']) expect(ok(phoneSchema(), phone), phone).toBe(true);
    for (const phone of ['abc', '12', '------', '0555 12 34 56 78 90 12 34']) expect(ok(phoneSchema(), phone), phone).toBe(false);
  });

  it('refuses a child enrolled before being born', () => {
    const child = { firstName: 'Lina', lastName: 'Ben Ali', gender: 'female', academicYearId: '11111111-1111-4111-8111-111111111111' };
    expect(ok(createChildSchema, { ...child, dateOfBirth: day(-800), enrollmentDate: day(-10) })).toBe(true);
    expect(ok(createChildSchema, { ...child, dateOfBirth: day(-10), enrollmentDate: day(-800) })).toBe(false);
    expect(ok(createChildSchema, { ...child, dateOfBirth: day(40), enrollmentDate: day(50) })).toBe(false);
    expect(ok(createChildSchema, { ...child, lastName: 'B', dateOfBirth: day(-800), enrollmentDate: day(-10) })).toBe(false);
    expect(ok(updateChildSchema, { dateOfBirth: day(-10), enrollmentDate: day(-800) })).toBe(false);
    expect(ok(updateChildSchema, { address: 'Alger' })).toBe(true);
  });

  it('refuses a contract that ends before it starts, and a class of a thousand', () => {
    const profile = { userId: '11111111-1111-4111-8111-111111111111', position: 'Éducatrice', contractType: 'full_time' };
    expect(ok(createStaffProfileSchema, { ...profile, contractStart: '2025-09-01', contractEnd: '2026-06-30' })).toBe(true);
    expect(ok(createStaffProfileSchema, { ...profile, contractStart: '2025-09-01', contractEnd: '2025-06-30' })).toBe(false);
    const classroom = { name: 'Petite section', academicYearId: '11111111-1111-4111-8111-111111111111' };
    expect(ok(createClassroomSchema, { ...classroom, capacity: 25 })).toBe(true);
    expect(ok(createClassroomSchema, { ...classroom, capacity: 1000 })).toBe(false);
  });
});
