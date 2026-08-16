import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { HeartPulse } from 'lucide-react';
import { Avatar, StatusBadge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } from '@/components/ui';
import { useTeacherClassroom, useClassroomChildren, type ClassroomChild } from '@/hooks/useTeacherClassroom';
import { useMedicalNotes } from '@/hooks/useChildren';

function severityBadgeVariant(severity: 'low' | 'medium' | 'high'): 'present' | 'late' | 'absent' {
  if (severity === 'high') return 'absent';
  if (severity === 'medium') return 'late';
  return 'present';
}

function MedicalNotesViewDialog({
  open,
  onOpenChange,
  child,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: ClassroomChild | null;
}) {
  const { t } = useTranslation();
  const { data: notes = [], isLoading } = useMedicalNotes(child?.id ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('children.medicalNotes.title')}</DialogTitle>
          <DialogDescription>
            {t('children.medicalNotes.description', { name: child ? `${child.first_name} ${child.last_name}` : '' })}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-caption text-text-secondary mb-4">{t('common.loading')}</p>}

        {!isLoading && notes.length === 0 && (
          <p className="text-body text-text-secondary mb-4">{t('children.medicalNotes.noNotes')}</p>
        )}

        {notes.length > 0 && (
          <div className="space-y-2 mb-2">
            {notes.map((n) => (
              <div key={n.id} className="p-3 bg-subtle rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-body font-medium text-foreground">{n.title}</span>
                  <StatusBadge variant={severityBadgeVariant(n.severity)}>
                    {t(`children.medicalNotes.severities.${n.severity}`)}
                  </StatusBadge>
                </div>
                <p className="text-caption text-text-secondary">
                  {t(`children.medicalNotes.types.${n.type}`)}
                  {n.details && <span> • {n.details}</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small card-corner warning shown when a child has a high-severity medical note. */
function HighSeverityBadge({ childId }: { childId: string }) {
  const { t } = useTranslation();
  const { data: notes } = useMedicalNotes(childId);
  if (!notes || !notes.some((n) => n.severity === 'high')) return null;
  return (
    <StatusBadge variant="absent" title={t('children.medicalNotes.highSeverityWarning')}>
      {t('children.medicalNotes.highSeverityWarning')}
    </StatusBadge>
  );
}

export function TeacherChildrenPage() {
  const { t } = useTranslation();
  const { data: classroom, isLoading: classroomLoading } = useTeacherClassroom();
  const { data: children, isLoading: childrenLoading } = useClassroomChildren(classroom?.id);
  const [selectedChild, setSelectedChild] = React.useState<ClassroomChild | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const isLoading = classroomLoading || childrenLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="animate-pulse space-y-4 w-full max-w-2xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-subtle rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-body text-text-secondary">{t('teacherAttendance.noClassroom')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-subsection font-semibold text-text-heading">
            {t('teacherChildren.title')}
          </h1>
          <p className="text-caption text-text-secondary">
            {classroom.name} — {classroom.level}
          </p>
        </div>
      </header>

      <div className="flex-1 px-4 py-3 max-w-2xl mx-auto w-full">
        <div className="space-y-3">
          {children && children.length > 0 ? (
            children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => { setSelectedChild(child); setDialogOpen(true); }}
                className="w-full flex items-center gap-3 bg-card border border-border rounded-lg p-4 transition-all duration-150 active:scale-[0.98] text-start"
              >
                <Avatar src={child.photo_url} name={`${child.first_name} ${child.last_name}`} size="md" />
                <span className="text-body font-medium text-text-heading flex-1">
                  {child.first_name} {child.last_name}
                </span>
                <HighSeverityBadge childId={child.id} />
                <HeartPulse className="w-5 h-5 text-text-secondary" />
              </button>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-body text-text-secondary">{t('teacherAttendance.noChildren')}</p>
            </div>
          )}
        </div>
      </div>

      <MedicalNotesViewDialog open={dialogOpen} onOpenChange={setDialogOpen} child={selectedChild} />
    </div>
  );
}
