import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { ClassColorPicker, ClassTag, classColor, type ClassColor } from '@/components/ClassTag';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserCog } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EditButton,
  EditFormActions,
  EntityDeleteButton,
  PageHeader,
  ReadOnlyFieldset,
  useEditMode,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import {
  useClassroom,
  useUpdateClassroom,
  useAssignTeacher,
} from '@/hooks/useClassrooms';
import { useUsers } from '@/hooks/useUsers';
import { ClassroomFeesSection } from './ClassroomFeesSection';
import { RoomField } from './RoomField';
import { useSelectedYear, useYearClosed } from '@/hooks/useSelectedYear';
import { ClassSubstitutionsSection } from './SubstitutionsSection';
import { usePermissions } from '@/lib/roles';

export function ClassroomDetailPage() {
  const { t } = useTranslation();
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();

  const { data: classroom, isLoading } = useClassroom(classroomId!);
  // A class of a closed year is looked at, not changed.
  const { can, canDelete } = usePermissions();
  // Read-only: a closed year, or a profile that only views classes.
  const closed = useYearClosed(classroom?.academic_year_id) || !can('classes', 'edit');
  const { activeYear } = useSelectedYear();
  const updateClassroom = useUpdateClassroom();
  const assignTeacher = useAssignTeacher();

  const { data: usersData } = useUsers({ pageSize: 100 });
  const teachers = (usersData?.users ?? []).filter((u) => u.role === 'teacher');

  const [formData, setFormData] = React.useState({
    name: '',
    capacity: '',
    room_id: '',
    level: '',
    color: null as ClassColor | null,
  });
  const [teacherId, setTeacherId] = React.useState('');
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [teacherError, setTeacherError] = React.useState<string | null>(null);
  const [teacherDialogOpen, setTeacherDialogOpen] = React.useState(false);

  const toForm = React.useCallback(
    (c: NonNullable<typeof classroom>) => ({
      name: c.name,
      capacity: String(c.capacity),
      room_id: c.room_id ?? '',
      level: c.level ?? '',
      color: c.color ? classColor(c.id, c.color) : null,
    }),
    [],
  );
  const edit = useEditMode(() => {
    if (classroom) setFormData(toForm(classroom));
    setSaveError(null);
  });

  // Follow the saved class while reading; never overwrite what is being typed.
  React.useEffect(() => {
    if (classroom && !edit.editing) setFormData(toForm(classroom));
  }, [classroom, edit.editing, toForm]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateClassroom.mutateAsync({
        id: classroomId!,
        name: formData.name,
        capacity: Number(formData.capacity),
        room_id: formData.room_id || null,
        level: formData.level || null,
        color: formData.color,
      });
      edit.finishEditing();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(errorMessage(err, t));
    }
  }

  async function handleAssignTeacher() {
    setTeacherError(null);
    try {
      await assignTeacher.mutateAsync({ classroomId: classroomId!, teacherId: teacherId || null });
      setTeacherDialogOpen(false);
    } catch (err) {
      setTeacherError(errorMessage(err, t));
    }
  }

  const teacherOptions = [
    { value: '', label: t('classrooms.form.noTeacher') },
    ...teachers.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` })),
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-10 bg-hover rounded-md" />
          <div className="h-10 bg-hover rounded-md w-1/2" />
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader back="/admin/classrooms" title={t('classrooms.notFound')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        back="/admin/classrooms"
        title={classroom.name}
        badge={<ClassTag id={classroom.id} name={classroom.level || classroom.name} color={classColor(classroom.id, classroom.color)} />}
        description={
          <>
            {classroom.enrolled_count}/{classroom.capacity} {t('classrooms.columns.capacity').toLowerCase()}
            {classroom.teacher_name && ` · ${classroom.teacher_name}`}
          </>
        }
      />

      {/* Edit form */}
      <form onSubmit={handleSave}>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-subsection font-semibold text-text-heading">{t('classrooms.detail.info')}</h2>
            <EditButton onClick={edit.startEditing} hidden={edit.editing || closed} />
          </div>
          <ReadOnlyFieldset readOnly={!edit.editing}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <FormField label={t('classrooms.form.name')} htmlFor="cr-name" required>
              <Input id="cr-name" name="name" value={formData.name} onChange={handleChange} />
            </FormField>
            <FormField label={t('classrooms.form.capacity')} htmlFor="cr-capacity" required>
              <Input id="cr-capacity" name="capacity" type="number" min="1" value={formData.capacity} onChange={handleChange} />
            </FormField>
            <FormField label={t('classrooms.form.level')} htmlFor="cr-level">
              <Input id="cr-level" name="level" value={formData.level} onChange={handleChange} placeholder={t('classrooms.form.levelPlaceholder')} />
            </FormField>
            <RoomField
              id="cr-room"
              value={formData.room_id}
              onChange={(roomId) => setFormData((prev) => ({ ...prev, room_id: roomId }))}
              academicYearId={classroom.academic_year_id}
              placed={{ id: classroom.id, capacity: Number(formData.capacity) || 0, working_days: classroom.working_days }}
            />
            <FormField label={t('classrooms.form.color')} helperText={edit.editing ? t('classrooms.form.colorHint') : undefined}>
              <ClassColorPicker
                value={formData.color ?? (edit.editing ? null : classColor(classroom.id, classroom.color))}
                onChange={(color) => setFormData((prev) => ({ ...prev, color }))}
                disabled={!edit.editing}
              />
            </FormField>
          </div>
          </ReadOnlyFieldset>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4 empty:hidden">
          {edit.editing && <EditFormActions saving={updateClassroom.isPending} onCancel={edit.cancelEditing} />}
          {saveSuccess && <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>}
          {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
        </div>
      </form>

      {/* Teacher assignment */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-subsection font-semibold text-text-heading">{t('classrooms.form.teacher')}</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={closed ? 'hidden' : undefined}
            onClick={() => {
              setTeacherId(classroom.teacher_id ?? '');
              setTeacherError(null);
              setTeacherDialogOpen(true);
            }}
          >
            <UserCog className="w-4 h-4" />
            {classroom.teacher_name ? t('classrooms.detail.changeTeacher') : t('classrooms.assignTeacher.title')}
          </Button>
        </div>
        <p className={classroom.teacher_name ? 'text-body text-foreground' : 'text-body text-text-secondary'}>
          {classroom.teacher_name ?? t('classrooms.form.noTeacher')}
        </p>
      </div>

      <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {classroom.teacher_name ? t('classrooms.detail.changeTeacher') : t('classrooms.assignTeacher.title')}
            </DialogTitle>
            <DialogDescription>{t('classrooms.assignTeacher.description', { name: classroom.name })}</DialogDescription>
          </DialogHeader>
          <FormSelect
            label={t('classrooms.form.teacher')}
            name="teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            options={teacherOptions}
          />
          {teacherError && <p className="text-body text-danger">{teacherError}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setTeacherDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleAssignTeacher}
              disabled={assignTeacher.isPending || teacherId === (classroom.teacher_id ?? '')}
            >
              {assignTeacher.isPending ? t('common.loading') : t('classrooms.detail.assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replacements of the class's teacher */}
      <ClassSubstitutionsSection
        classroom={{ id: classroom.id, name: classroom.name, teacherId: classroom.teacher_id ?? null, academicYearId: classroom.academic_year_id }}
        readOnly={closed}
      />

      {/* Assigned fees */}
      <ClassroomFeesSection
        classroom={{
          id: classroom.id,
          name: classroom.name,
          childCount: classroom.enrolled_count,
          isCurrentYear: !!activeYear?.is_active && classroom.academic_year_id === activeYear.id,
          readOnly: closed || !can('fees', 'edit'),
        }}
      />

      {/* Danger zone */}
      <div className={`${closed || !can('classes', 'edit') || !canDelete ? 'hidden ' : ''}bg-card border border-border border-danger/30 rounded-lg p-6 space-y-3`}>
        <h2 className="text-subsection font-semibold text-danger">{t('classrooms.detail.dangerZone')}</h2>
        <p className="text-body text-text-secondary">{t('classrooms.detail.deleteWarning')}</p>
        <EntityDeleteButton
          entityType="classrooms"
          entityId={classroomId!}
          entityDisplayName={classroom.name}
          onDeleted={() => navigate('/admin/classrooms')}
          hidden={!!classroom.deletedAt}
        />
      </div>
    </div>
  );
}
