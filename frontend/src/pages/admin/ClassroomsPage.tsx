import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Users, UserCog } from 'lucide-react';
import {
  ErrorAlert,
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
import { EmptyState, FilterBar, ListSkeleton, PageHeader } from '@/components/ui';

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
    } catch (err) {
      setErrors((prev) => ({ ...prev, form: errorMessage(err, t) }));
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

          <ErrorAlert message={errors.form} className="mt-3" />

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
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (classroom) {
      setTeacherId(classroom.teacher_id ?? '');
    }
  }, [classroom]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classroom || !teacherId) return;

    setSubmitError(null);
    try {
      await assignTeacher.mutateAsync({ classroomId: classroom.id, teacherId });
      onOpenChange(false);
    } catch (err) {
      setSubmitError(errorMessage(err, t));
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

          <ErrorAlert message={submitError} className="mt-3" />

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

  // ─── Filters (a school has few classes, so filter here) ───
  const [search, setSearch] = React.useState('');
  const [levelFilter, setLevelFilter] = React.useState('');
  const [teacherFilter, setTeacherFilter] = React.useState('');
  const [occupancyFilter, setOccupancyFilter] = React.useState<'' | 'available' | 'full'>('');

  const levelOptions = React.useMemo(
    () => [...new Set((classrooms ?? []).map((c) => c.level).filter(Boolean))].sort(),
    [classrooms],
  );
  const teacherOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of classrooms ?? []) if (c.teacher_id && c.teacher_name) byId.set(c.teacher_id, c.teacher_name);
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [classrooms]);

  const filteredClassrooms = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (classrooms ?? []).filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle) && !(c.room_number ?? '').toLowerCase().includes(needle)) {
        return false;
      }
      if (levelFilter && c.level !== levelFilter) return false;
      if (teacherFilter === '__none__' && c.teacher_id) return false;
      if (teacherFilter && teacherFilter !== '__none__' && c.teacher_id !== teacherFilter) return false;
      if (occupancyFilter === 'full' && c.enrolled_count < c.capacity) return false;
      if (occupancyFilter === 'available' && c.enrolled_count >= c.capacity) return false;
      return true;
    });
  }, [classrooms, search, levelFilter, teacherFilter, occupancyFilter]);

  const hasFilters = !!(search || levelFilter || teacherFilter || occupancyFilter);

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

  const data = filteredClassrooms;
  const enrolledTotal = data.reduce((sum, c) => sum + c.enrolled_count, 0);
  const capacityTotal = data.reduce((sum, c) => sum + c.capacity, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('classrooms.title')}
        description={activeYear?.name}
        actions={
          <CreateButton
            label={t('classrooms.create')}
            onClick={() => setCreateDialogOpen(true)}
            disabled={!activeYear}
          />
        }
      />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !activeYear ? (
        <EmptyState message={t('classrooms.noActiveYear')} />
      ) : (
        <>
          <FilterBar
            search={{ onSearch: setSearch, placeholder: t('classrooms.filters.searchPlaceholder'), defaultValue: search }}
            activeCount={[levelFilter, teacherFilter, occupancyFilter].filter(Boolean).length}
            summary={t('classrooms.filters.summary', { count: data.length, enrolled: enrolledTotal, capacity: capacityTotal })}
            onReset={() => {
              setLevelFilter('');
              setTeacherFilter('');
              setOccupancyFilter('');
            }}
            columns={3}
          >
            <FormSelect
              label={t('classrooms.filters.level')}
              name="classrooms-filter-level"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              options={[
                { value: '', label: t('classrooms.filters.allLevels') },
                ...levelOptions.map((level) => ({ value: level, label: level })),
              ]}
            />
            <FormSelect
              label={t('classrooms.filters.teacher')}
              name="classrooms-filter-teacher"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              options={[
                { value: '', label: t('classrooms.filters.allTeachers') },
                { value: '__none__', label: t('classrooms.noTeacher') },
                ...teacherOptions.map(([value, label]) => ({ value, label })),
              ]}
            />
            <FormSelect
              label={t('classrooms.filters.occupancy')}
              name="classrooms-filter-occupancy"
              value={occupancyFilter}
              onChange={(e) => setOccupancyFilter(e.target.value as '' | 'available' | 'full')}
              options={[
                { value: '', label: t('classrooms.filters.allOccupancy') },
                { value: 'available', label: t('classrooms.filters.available') },
                { value: 'full', label: t('classrooms.filters.full') },
              ]}
            />
          </FilterBar>

          <DataTable<Classroom>
            columns={columns}
            data={data}
            keyExtractor={(c) => c.id}
            onRowClick={(c) => navigate(`/admin/classrooms/${c.id}`)}
            emptyMessage={hasFilters ? t('classrooms.filters.noMatch') : t('classrooms.noClassrooms')}
          />
        </>
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
