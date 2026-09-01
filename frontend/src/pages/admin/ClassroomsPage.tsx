import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Users, UserCog } from 'lucide-react';
import {
  Button,
  CreateButton,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import {
  useClassrooms,
  useCreateClassroom,
  useAssignTeacher,
  type Classroom,
} from '@/hooks/useClassrooms';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useUsers } from '@/hooks/useUsers';

function CreateClassroomDialog({
  open,
  onOpenChange,
  academicYearId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicYearId: string;
}) {
  const { t } = useTranslation();
  const createClassroom = useCreateClassroom();
  const { data: usersData } = useUsers({ pageSize: 100 });

  const teachers = (usersData?.users ?? []).filter((u) => u.role === 'teacher');

  const [formData, setFormData] = React.useState({
    name: '',
    capacity: '',
    room_number: '',
    level: '',
    teacher_id: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function resetForm() {
    setFormData({ name: '', capacity: '', room_number: '', level: '', teacher_id: '' });
    setErrors({});
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = t('classrooms.form.nameRequired');
    }
    if (!formData.capacity || Number(formData.capacity) <= 0) {
      newErrors.capacity = t('classrooms.form.capacityRequired');
    }
    if (!formData.level.trim()) {
      newErrors.level = t('classrooms.form.levelRequired');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createClassroom.mutateAsync({
        name: formData.name,
        capacity: Number(formData.capacity),
        room_number: formData.room_number || undefined,
        level: formData.level,
        academic_year_id: academicYearId,
        teacher_id: formData.teacher_id || undefined,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by React Query
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  const teacherOptions = [
    { value: '', label: t('classrooms.form.noTeacher') },
    ...teachers.map((teacher) => ({
      value: teacher.id,
      label: `${teacher.first_name} ${teacher.last_name}`,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('classrooms.form.title')}</DialogTitle>
          <DialogDescription>{t('classrooms.form.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormField
            label={t('classrooms.form.name')}
            htmlFor="cr-name"
            error={errors.name}
            required
          >
            <Input
              id="cr-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('classrooms.form.namePlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('classrooms.form.capacity')}
              htmlFor="cr-capacity"
              error={errors.capacity}
              required
            >
              <Input
                id="cr-capacity"
                name="capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="25"
              />
            </FormField>

            <FormField
              label={t('classrooms.form.roomNumber')}
              htmlFor="cr-room-number"
            >
              <Input
                id="cr-room-number"
                name="room_number"
                value={formData.room_number}
                onChange={handleChange}
                placeholder={t('classrooms.form.roomNumberPlaceholder')}
              />
            </FormField>
          </div>

          <FormField
            label={t('classrooms.form.level')}
            htmlFor="cr-level"
            error={errors.level}
            required
          >
            <Input
              id="cr-level"
              name="level"
              value={formData.level}
              onChange={handleChange}
              placeholder={t('classrooms.form.levelPlaceholder')}
            />
          </FormField>

          <FormSelect
            label={t('classrooms.form.teacher')}
            name="teacher_id"
            value={formData.teacher_id}
            onChange={handleSelectChange}
            options={teacherOptions}
          />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createClassroom.isPending}>
              {createClassroom.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignTeacherDialog({
  open,
  onOpenChange,
  classroom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: Classroom | null;
}) {
  const { t } = useTranslation();
  const assignTeacher = useAssignTeacher();
  const { data: usersData } = useUsers({ pageSize: 100 });

  const teachers = (usersData?.users ?? []).filter((u) => u.role === 'teacher');
  const [teacherId, setTeacherId] = React.useState('');

  React.useEffect(() => {
    if (classroom) {
      setTeacherId(classroom.teacher_id ?? '');
    }
  }, [classroom]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classroom || !teacherId) return;

    try {
      await assignTeacher.mutateAsync({ classroomId: classroom.id, teacherId });
      onOpenChange(false);
    } catch {
      // Error handled by React Query
    }
  }

  const teacherOptions = teachers.map((teacher) => ({
    value: teacher.id,
    label: `${teacher.first_name} ${teacher.last_name}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('classrooms.assignTeacher.title')}</DialogTitle>
          <DialogDescription>
            {t('classrooms.assignTeacher.description', { name: classroom?.name })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormSelect
            label={t('classrooms.form.teacher')}
            name="teacher_id"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            options={teacherOptions}
            placeholder={t('classrooms.assignTeacher.selectTeacher')}
          />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={assignTeacher.isPending || !teacherId}>
              {assignTeacher.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClassroomsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const { data: classrooms, isLoading } = useClassrooms(activeYear?.id);

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [selectedClassroom, setSelectedClassroom] = React.useState<Classroom | null>(null);

  function handleAssignTeacher(classroom: Classroom) {
    setSelectedClassroom(classroom);
    setAssignDialogOpen(true);
  }

  const columns: Column<Classroom>[] = [
    {
      key: 'name',
      header: t('classrooms.columns.name'),
      sortable: true,
      render: (classroom) => (
        <p className="text-body font-medium text-foreground">{classroom.name}</p>
      ),
    },
    {
      key: 'level',
      header: t('classrooms.columns.level'),
      sortable: true,
      render: (classroom) => (
        <span className="text-body text-text-secondary">{classroom.level}</span>
      ),
    },
    {
      key: 'capacity',
      header: t('classrooms.columns.capacity'),
      sortable: true,
      render: (classroom) => (
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-text-secondary" />
          <span className="text-body text-foreground">
            {classroom.enrolled_count}/{classroom.capacity}
          </span>
        </div>
      ),
    },
    {
      key: 'teacher_name',
      header: t('classrooms.columns.teacher'),
      render: (classroom) =>
        classroom.teacher_name ? (
          <span className="text-body text-foreground">{classroom.teacher_name}</span>
        ) : (
          <span className="text-body text-text-disabled">{t('classrooms.noTeacher')}</span>
        ),
    },
    {
      key: 'room_number',
      header: t('classrooms.columns.roomNumber'),
      render: (classroom) => (
        <span className="text-body text-text-secondary">
          {classroom.room_number || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (classroom) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleAssignTeacher(classroom); }}
            aria-label={t('classrooms.assignTeacher.title')}
          >
            <UserCog className="w-4 h-4" />
          </Button>
        </div>
      ),
      className: 'w-16',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('classrooms.title')}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const data = classrooms ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('classrooms.title')}
          </h1>
          {activeYear && (
            <p className="text-caption text-text-secondary mt-1">
              {activeYear.name}
            </p>
          )}
        </div>
        <CreateButton
          label={t('classrooms.create')}
          onClick={() => setCreateDialogOpen(true)}
          disabled={!activeYear}
        />
      </div>

      {!activeYear ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-body text-text-secondary">
            {t('classrooms.noActiveYear')}
          </p>
        </div>
      ) : (
        <DataTable<Classroom>
          columns={columns}
          data={data}
          keyExtractor={(c) => c.id}
          onRowClick={(c) => navigate(`/admin/classrooms/${c.id}`)}
          emptyMessage={t('classrooms.noClassrooms')}
        />
      )}

      {activeYear && (
        <CreateClassroomDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          academicYearId={activeYear.id}
        />
      )}

      <AssignTeacherDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        classroom={selectedClassroom}
      />
    </div>
  );
}
