import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import i18next, { type TFunction } from 'i18next';
import { FormSelect } from '@/components/forms';
import { useRooms, type Room } from '@/hooks/useRooms';

/** Days a new class is open until set otherwise (the database default). */
export const DEFAULT_WORKING_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

export const ROOMS_HREF = '/admin/settings?tab=rooms';

/** Keeps a name in its own direction inside a sentence (Latin names in Arabic text). */
const isolate = (name: string) => `\u2068${name}\u2069`;

function dayList(t: TFunction, days: string[]): string {
  const separator = i18next.language?.startsWith('ar') ? '، ' : ', ';
  return days.map((d) => t(`timetable.days.${d}`)).join(separator);
}

interface PlacedClass {
  /** Absent for a class not created yet. */
  id?: string;
  capacity: number;
  working_days: string[];
}

/**
 * What is wrong with placing a class in a room: more children than the room
 * holds, or another class of the year in it on the same days. Only warnings —
 * a morning and an afternoon group may well share a room.
 */
export function roomWarnings(t: TFunction, room: Room, placed: PlacedClass): string[] {
  const warnings: string[] = [];
  if (room.capacity !== null && placed.capacity > room.capacity) {
    warnings.push(
      t('rooms.warnings.overCapacity', { classCapacity: placed.capacity, room: isolate(room.name), roomCapacity: room.capacity }),
    );
  }
  for (const other of room.classrooms) {
    if (other.id === placed.id) continue;
    const shared = other.working_days.filter((d) => placed.working_days.includes(d));
    if (shared.length > 0) {
      warnings.push(
        t('rooms.warnings.shared', { room: isolate(room.name), classroom: isolate(other.name), days: dayList(t, shared) }),
      );
    }
  }
  return warnings;
}

/**
 * A room's problems as listed on its card: each class too big for it, and
 * each pair of classes sharing it on the same days (said once per pair).
 */
export function roomCardWarnings(t: TFunction, room: Room): string[] {
  const warnings: string[] = [];
  for (const c of room.classrooms) {
    if (room.capacity !== null && c.capacity > room.capacity) {
      warnings.push(t('rooms.warnings.classTooBig', { classroom: isolate(c.name), classCapacity: c.capacity, roomCapacity: room.capacity }));
    }
  }
  room.classrooms.forEach((a, i) => {
    for (const b of room.classrooms.slice(i + 1)) {
      const shared = a.working_days.filter((d) => b.working_days.includes(d));
      if (shared.length > 0) {
        warnings.push(t('rooms.warnings.sharedPair', { first: isolate(a.name), second: isolate(b.name), days: dayList(t, shared) }));
      }
    }
  });
  return warnings;
}

export function roomLabel(t: TFunction, room: Room): string {
  const parts = [room.name];
  if (room.capacity !== null) parts.push(t('rooms.places', { count: room.capacity }));
  return parts.join(' · ') + (room.is_active ? '' : ` (${t('rooms.inactive')})`);
}

/** Picks the room of a class among the school's active rooms (or keeps its current one), with warnings. */
export function RoomField({
  id,
  value,
  onChange,
  academicYearId,
  placed,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (roomId: string) => void;
  academicYearId?: string;
  placed: PlacedClass;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { data: rooms = [] } = useRooms(academicYearId);
  const choices = rooms.filter((r) => r.is_active || r.id === value);
  const selected = rooms.find((r) => r.id === value);
  const warnings = selected ? roomWarnings(t, selected, placed) : [];

  return (
    <div>
      <FormSelect
        id={id}
        label={t('classrooms.form.roomNumber')}
        name="room_id"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        options={[
          { value: '', label: t('rooms.noRoom') },
          ...choices.map((r) => ({ value: r.id, label: roomLabel(t, r) })),
        ]}
      />
      {warnings.map((w) => (
        <p key={w} className="text-caption text-warning flex items-start gap-1.5 -mt-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{w}</span>
        </p>
      ))}
      {rooms.length === 0 && (
        <p className="text-caption text-text-secondary -mt-2 mb-3">
          <Link to={ROOMS_HREF} className="text-primary hover:underline">{t('rooms.selectHint')}</Link>
        </p>
      )}
    </div>
  );
}
