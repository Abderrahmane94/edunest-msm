import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, UserCog } from 'lucide-react';
import { Button, EntityDeleteButton } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import {
  useClassroom,
  useUpdateClassroom,
  useAssignTeacher,
} from '@/hooks/useClassrooms';
import { useUsers } from '@/hooks/useUsers';

export function ClassroomDetailPage() {
  const { t } = useTranslation();
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();

  const { data: classroom, isLoading } = useClassroom(classroomId!);
  const updateClassroom = useUpdateClassroom();
  const assignTeacher = useAssignTeacher();

  const { data: usersData } = useUsers({ pageSize: 100 });
  const teachers = (usersData?.users ?? []).filter((u) => u.role === 'teacher');

  const [formData, setFormData] = React.useState({
    name: '',
    capacity: '',
    room_number: '',
    level: '',
  });
  const [teacherId, setTeacherId] = React.useState('');
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [teacherError, setTeacherError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (classroom) {
      setFormData({
        name: classroom.name,
        capacity: String(classroom.capacity),
        room_number: classroom.room_number ?? '',
        level: classroom.level ?? '',
      });
      setTeacherId(classroom.teacher_id ?? '');
    }
  }, [classroom]);

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
        room_number: formData.room_number || null,
        level: formData.level || null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleAssignTeacher() {
    setTeacherError(null);
    try {
      await assignTeacher.mutateAsync({ classroomId: classroomId!, teacherId: teacherId || null });
    } catch (err) {
      setTeacherError(err instanceof Error ? err.message : t('common.error'));
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
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/classrooms')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('classrooms.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/classrooms')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <div className="flex-1">
          <h1 className="text-page-title font-semibold text-text-heading">{classroom.name}</h1>
          <p className="text-body text-text-secondary">
            {classroom.enrolled_count}/{classroom.capacity} {t('classrooms.columns.capacity').toLowerCase()}
            {classroom.teacher_name && ` · ${classroom.teacher_name}`}
          </p>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave}>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-subsection font-semibold text-text-heading">{t('classrooms.detail.info')}</h2>
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
            <FormField label={t('classrooms.form.roomNumber')} htmlFor="cr-room">
              <Input id="cr-room" name="room_number" value={formData.room_number} onChange={handleChange} placeholder={t('classrooms.form.roomNumberPlaceholder')} />
            </FormField>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <Button type="submit" disabled={updateClassroom.isPending}>
            <Save className="w-4 h-4" />
            {updateClassroom.isPending ? t('common.loading') : t('common.save')}
          </Button>
          {saveSuccess && <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>}
          {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
        </div>
      </form>

      {/* Teacher assignment */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-subsection font-semibold text-text-heading">{t('classrooms.assignTeacher.title')}</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <FormSelect
              label={t('classrooms.form.teacher')}
              name="teacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              options={teacherOptions}
            />
          </div>
          <Button type="button" variant="secondary" onClick={handleAssignTeacher} disabled={assignTeacher.isPending}>
            <UserCog className="w-4 h-4" />
            {assignTeacher.isPending ? t('common.loading') : t('classrooms.detail.assign')}
          </Button>
        </div>
        {teacherError && <p className="text-body text-danger">{teacherError}</p>}
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-border border-danger/30 rounded-lg p-6 space-y-3">
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
