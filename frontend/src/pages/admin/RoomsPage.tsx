import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, DoorOpen, Pencil, Power, Trash2 } from 'lucide-react';
import {
  Button,
  CreateButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorAlert,
  Input,
  ListSkeleton,
  SectionHeader,
  StatusBadge,
  useConfirm,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { cn } from '@/lib/utils';
import { useViewedYear } from '@/hooks/useSelectedYear';
import { useCreateRoom, useDeleteRoom, useRooms, useUpdateRoom, type Room } from '@/hooks/useRooms';
import { useEquipment } from '@/hooks/useEquipment';
import { roomCardWarnings } from './RoomField';
import { yearLabel } from '@/lib/yearName';

function RoomDialog({
  open,
  onOpenChange,
  room,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The room being changed; none to add one. */
  room: Room | null;
}) {
  const { t } = useTranslation();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const [form, setForm] = React.useState({ name: '', capacity: '', location: '', notes: '' });
  const [error, setError] = React.useState<string | null>(null);
  const saving = createRoom.isPending || updateRoom.isPending;

  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: room?.name ?? '',
      capacity: room?.capacity != null ? String(room.capacity) : '',
      location: room?.location ?? '',
      notes: room?.notes ?? '',
    });
    setError(null);
  }, [open, room]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const data = {
      name: form.name.trim(),
      capacity: form.capacity ? Number(form.capacity) : null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (room) await updateRoom.mutateAsync({ id: room.id, ...data });
      else await createRoom.mutateAsync(data);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? t('rooms.form.editTitle') : t('rooms.form.createTitle')}</DialogTitle>
          <DialogDescription>{t('rooms.form.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormField label={t('rooms.form.name')} htmlFor="room-name" required>
            <Input
              id="room-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder={t('rooms.form.namePlaceholder')}
              maxLength={100}
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('rooms.form.capacity')} htmlFor="room-capacity" helperText={t('rooms.form.capacityHint')}>
              <Input id="room-capacity" name="capacity" type="number" min="1" step="1" value={form.capacity} onChange={handleChange} />
            </FormField>
            <FormField label={t('rooms.form.location')} htmlFor="room-location">
              <Input
                id="room-location"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder={t('rooms.form.locationPlaceholder')}
                maxLength={100}
              />
            </FormField>
          </div>
          <FormField label={t('rooms.form.notes')} htmlFor="room-notes">
            <Input
              id="room-notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder={t('rooms.form.notesPlaceholder')}
              maxLength={500}
            />
          </FormField>

          <ErrorAlert message={error} className="mb-3" />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.loading') : room ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoomCard({
  room,
  onEdit,
  onToggleActive,
  onDelete,
  busy,
}: {
  room: Room;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const warnings = roomCardWarnings(t, room);

  return (
    <div className={cn('bg-card border border-border rounded-lg p-4 space-y-3', !room.is_active && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-accent-muted text-primary flex items-center justify-center shrink-0">
            <DoorOpen className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body font-semibold text-foreground">{room.name}</p>
              {!room.is_active && <StatusBadge variant="neutral">{t('rooms.inactive')}</StatusBadge>}
            </div>
            <p className="text-caption text-text-secondary">
              {[
                room.capacity !== null ? t('rooms.places', { count: room.capacity }) : t('rooms.noCapacity'),
                room.location,
              ].filter(Boolean).join(' · ')}
            </p>
            {room.notes && <p className="text-caption text-text-secondary">{room.notes}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={t('rooms.edit')} title={t('rooms.edit')}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleActive}
            disabled={busy}
            aria-label={room.is_active ? t('rooms.deactivate') : t('rooms.activate')}
            title={room.is_active ? t('rooms.deactivate') : t('rooms.activate')}
          >
            <Power className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={busy}
            aria-label={t('rooms.delete')}
            title={t('rooms.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {room.classrooms.length === 0 ? (
          <StatusBadge variant="success">{t('rooms.free')}</StatusBadge>
        ) : (
          room.classrooms.map((c) => (
            <Link
              key={c.id}
              to={`/admin/classrooms/${c.id}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-subtle text-caption text-foreground hover:bg-hover"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-text-secondary">{c.enrolled_count}/{c.capacity}</span>
            </Link>
          ))
        )}
      </div>

      {warnings.map((w) => (
        <p key={w} className="text-caption text-warning flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{w}</span>
        </p>
      ))}
    </div>
  );
}

/** The "Salles" tab of Settings: the school's rooms and the classes in them this year. */
export function RoomsSection() {
  const { t, i18n } = useTranslation();
  const { data: activeYear } = useViewedYear();
  const { data: rooms, isLoading } = useRooms(activeYear?.id);
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();
  const { data: equipment } = useEquipment();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Room | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Active rooms first, each group by name (the server sorts by name).
  const sorted = [...(rooms ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active));

  function openDialog(room: Room | null) {
    setEditing(room);
    setDialogOpen(true);
  }

  async function handleToggleActive(room: Room) {
    // Deactivating says what it changes first; reactivating changes nothing for anyone.
    if (room.is_active) {
      const classes = room.classrooms.map((c) => c.name);
      const pieces = (equipment ?? []).filter((e) => e.roomId === room.id).reduce((n, e) => n + e.quantity, 0);
      const ok = await confirm({
        title: t('rooms.deactivateConfirm.title', { name: room.name }),
        description: (
          <>
            {t('rooms.deactivateConfirm.description')}
            {classes.length > 0 && (
              <>
                {' '}
                {t('rooms.deactivateConfirm.classes', {
                  count: classes.length,
                  year: activeYear ? yearLabel(activeYear.name) : '',
                  names: classes.join(i18n.language === 'ar' ? '، ' : ', '),
                })}
              </>
            )}
            {pieces > 0 && <> {t('rooms.deactivateConfirm.equipment', { count: pieces })}</>}
          </>
        ),
        confirmLabel: t('rooms.deactivate'),
      });
      if (!ok) return;
    }
    setActionError(null);
    try {
      await updateRoom.mutateAsync({ id: room.id, isActive: !room.is_active });
    } catch (err) {
      setActionError(errorMessage(err, t));
    }
  }

  async function handleDelete(room: Room) {
    const ok = await confirm({
      title: t('rooms.deleteConfirm.title', { name: room.name }),
      description: t('rooms.deleteConfirm.description'),
      confirmLabel: t('rooms.delete'),
    });
    if (!ok) return;
    setActionError(null);
    try {
      await deleteRoom.mutateAsync(room.id);
    } catch (err) {
      setActionError(errorMessage(err, t));
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {confirmDialog}
      <SectionHeader
        title={t('rooms.title')}
        description={t('rooms.description')}
        actions={<CreateButton label={t('rooms.create')} onClick={() => openDialog(null)} />}
      />

      <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : sorted.length === 0 ? (
        <EmptyState message={t('rooms.empty')} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sorted.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onEdit={() => openDialog(room)}
              onToggleActive={() => handleToggleActive(room)}
              onDelete={() => handleDelete(room)}
              busy={updateRoom.isPending || deleteRoom.isPending}
            />
          ))}
        </div>
      )}

      <RoomDialog open={dialogOpen} onOpenChange={setDialogOpen} room={editing} />
    </div>
  );
}
