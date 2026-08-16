import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input, StatusBadge,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { cn } from '@/lib/utils';
import {
  useMedicalNotes, useAddMedicalNote, useUpdateMedicalNote, useRemoveMedicalNote,
  type MedicalNote, type MedicalNoteType, type MedicalNoteSeverity,
} from '@/hooks/useChildren';

const TYPE_VALUES: MedicalNoteType[] = ['allergy', 'condition', 'medication'];
const SEVERITY_VALUES: MedicalNoteSeverity[] = ['low', 'medium', 'high'];

interface NoteFormState {
  type: MedicalNoteType;
  title: string;
  details: string;
  severity: MedicalNoteSeverity;
}

const emptyForm: NoteFormState = { type: 'allergy', title: '', details: '', severity: 'low' };

export function severityBadgeVariant(severity: MedicalNoteSeverity): 'present' | 'late' | 'absent' {
  if (severity === 'high') return 'absent';
  if (severity === 'medium') return 'late';
  return 'present';
}

interface MedicalNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  childName: string;
}

export function MedicalNotesDialog({ open, onOpenChange, childId, childName }: MedicalNotesDialogProps) {
  const { t } = useTranslation();
  const { data: notes = [], isLoading: notesLoading } = useMedicalNotes(childId);
  const addNote = useAddMedicalNote();
  const updateNote = useUpdateMedicalNote();
  const removeNote = useRemoveMedicalNote();

  const typeOptions = TYPE_VALUES.map((v) => ({ value: v, label: t(`children.medicalNotes.types.${v}`) }));
  const severityOptions = SEVERITY_VALUES.map((v) => ({ value: v, label: t(`children.medicalNotes.severities.${v}`) }));

  const [newNote, setNewNote] = React.useState<NoteFormState>(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<NoteFormState>(emptyForm);
  const [editErrors, setEditErrors] = React.useState<Record<string, string>>({});
  const [editError, setEditError] = React.useState<string | null>(null);

  function validate(form: NoteFormState): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = t('children.medicalNotes.titleRequired');
    return errs;
  }

  async function handleAddNote() {
    const errs = validate(newNote);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitError(null);
    try {
      await addNote.mutateAsync({
        childId,
        type: newNote.type,
        title: newNote.title.trim(),
        details: newNote.details.trim() || undefined,
        severity: newNote.severity,
      });
      setNewNote(emptyForm);
      setErrors({});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleRemoveNote(noteId: string) {
    try {
      await removeNote.mutateAsync({ childId, noteId });
    } catch {
      // Surfaced via removeNote.isError below if needed
    }
  }

  function startEdit(note: MedicalNote) {
    setEditingId(note.id);
    setEditForm({ type: note.type, title: note.title, details: note.details ?? '', severity: note.severity });
    setEditErrors({});
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErrors({});
    setEditError(null);
  }

  async function handleSaveEdit(noteId: string) {
    const errs = validate(editForm);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setEditError(null);
    try {
      await updateNote.mutateAsync({
        childId,
        noteId,
        type: editForm.type,
        title: editForm.title.trim(),
        details: editForm.details.trim() || undefined,
        severity: editForm.severity,
      });
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const textareaClass = cn(
    'w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground placeholder:text-text-disabled',
    'transition-all duration-150',
    'focus:outline-none focus:border-primary focus:shadow-focus-ring',
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('children.medicalNotes.title')}</DialogTitle>
          <DialogDescription>
            {t('children.medicalNotes.description', { name: childName })}
          </DialogDescription>
        </DialogHeader>

        {notesLoading && (
          <p className="text-caption text-text-secondary mb-4">{t('common.loading')}</p>
        )}

        {!notesLoading && notes.length === 0 && (
          <p className="text-body text-text-secondary mb-4">{t('children.medicalNotes.noNotes')}</p>
        )}

        {notes.length > 0 && (
          <div className="space-y-2 mb-4">
            {notes.map((note) => (
              editingId === note.id ? (
                <div key={note.id} className="p-3 bg-subtle rounded-md space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <FormSelect
                      label={t('children.medicalNotes.type')}
                      name={`mn-edit-type-${note.id}`}
                      value={editForm.type}
                      onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as MedicalNoteType }))}
                      options={typeOptions}
                    />
                    <FormSelect
                      label={t('children.medicalNotes.severity')}
                      name={`mn-edit-severity-${note.id}`}
                      value={editForm.severity}
                      onChange={(e) => setEditForm((p) => ({ ...p, severity: e.target.value as MedicalNoteSeverity }))}
                      options={severityOptions}
                    />
                  </div>
                  <FormField label={t('children.medicalNotes.noteTitle')} htmlFor={`mn-edit-title-${note.id}`} error={editErrors.title} required>
                    <Input
                      id={`mn-edit-title-${note.id}`}
                      value={editForm.title}
                      onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder={t('children.medicalNotes.noteTitlePlaceholder')}
                    />
                  </FormField>
                  <FormField label={t('children.medicalNotes.details')} htmlFor={`mn-edit-details-${note.id}`}>
                    <textarea
                      id={`mn-edit-details-${note.id}`}
                      value={editForm.details}
                      onChange={(e) => setEditForm((p) => ({ ...p, details: e.target.value }))}
                      rows={2}
                      className={textareaClass}
                    />
                  </FormField>
                  {editError && <p className="text-body text-danger">{editError}</p>}
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => handleSaveEdit(note.id)} disabled={updateNote.isPending}>
                      <Check className="w-4 h-4" />
                      {t('children.medicalNotes.save')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={note.id} className="flex items-center justify-between p-3 bg-subtle rounded-md">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-body font-medium text-foreground">{note.title}</p>
                      <StatusBadge variant={severityBadgeVariant(note.severity)}>
                        {t(`children.medicalNotes.severities.${note.severity}`)}
                      </StatusBadge>
                    </div>
                    <p className="text-caption text-text-secondary">
                      {t(`children.medicalNotes.types.${note.type}`)}
                      {note.details && <span> • {note.details}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(note)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRemoveNote(note.id)}
                      disabled={removeNote.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-label font-medium text-foreground">
            {t('children.medicalNotes.addNew')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormSelect
              label={t('children.medicalNotes.type')}
              name="type"
              value={newNote.type}
              onChange={(e) => setNewNote((p) => ({ ...p, type: e.target.value as MedicalNoteType }))}
              options={typeOptions}
            />
            <FormSelect
              label={t('children.medicalNotes.severity')}
              name="severity"
              value={newNote.severity}
              onChange={(e) => setNewNote((p) => ({ ...p, severity: e.target.value as MedicalNoteSeverity }))}
              options={severityOptions}
            />
          </div>

          <FormField
            label={t('children.medicalNotes.noteTitle')}
            htmlFor="mn-title"
            error={errors.title}
            required
          >
            <Input
              id="mn-title"
              name="title"
              value={newNote.title}
              onChange={(e) => { setNewNote((p) => ({ ...p, title: e.target.value })); setErrors((p) => ({ ...p, title: '' })); }}
              placeholder={t('children.medicalNotes.noteTitlePlaceholder')}
            />
          </FormField>

          <FormField label={t('children.medicalNotes.details')} htmlFor="mn-details">
            <textarea
              id="mn-details"
              value={newNote.details}
              onChange={(e) => setNewNote((p) => ({ ...p, details: e.target.value }))}
              rows={2}
              placeholder={t('children.medicalNotes.detailsPlaceholder')}
              className={textareaClass}
            />
          </FormField>

          {submitError && <p className="text-body text-danger">{submitError}</p>}

          <Button type="button" variant="secondary" size="sm" onClick={handleAddNote} disabled={addNote.isPending}>
            <Plus className="w-4 h-4" />
            {addNote.isPending ? t('common.loading') : t('children.medicalNotes.add')}
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
