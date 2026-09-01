import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { useInviteUser } from '@/hooks/useUsers';
import { useRestoreRecord } from '@/hooks/useTrash';
import { ApiRequestError } from '@/lib/api-client';

interface InviteByEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteByEmailDialog({ open, onOpenChange }: InviteByEmailDialogProps) {
  const { t } = useTranslation();
  const inviteUser = useInviteUser();
  const restoreRecord = useRestoreRecord();

  const emptyForm = { email: '', role: 'teacher' };
  const [form, setForm] = React.useState(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [restorableUserId, setRestorableUserId] = React.useState<string | null>(null);

  function resetForm() {
    setForm(emptyForm);
    setErrors({});
    setInviteError(null);
    setIsSuccess(false);
    setRestorableUserId(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, email: e.target.value }));
    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, role: e.target.value }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.email.trim()) newErrors.email = t('users.invite_form.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = t('users.invite_form.emailInvalid');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setInviteError(null);
    setRestorableUserId(null);
    try {
      await inviteUser.mutateAsync({ email: form.email, role: form.role });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'RESTORABLE_USER_EXISTS') {
        setRestorableUserId((err.meta?.deletedUserId as string | undefined) ?? null);
      }
      setInviteError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleRestore() {
    if (!restorableUserId) return;
    setInviteError(null);
    try {
      await restoreRecord.mutateAsync({ entityType: 'users', id: restorableUserId });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const roleOptions = [
    { value: 'teacher', label: t('users.roles.teacher') },
    { value: 'parent', label: t('users.roles.parent') },
    { value: 'admin', label: t('users.roles.admin') },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.invite_form.title')}</DialogTitle>
          <DialogDescription>{t('users.invite_form.description')}</DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-2">
            <p className="text-body text-success mb-4">{t('users.invite_form.sent', { email: form.email })}</p>
            <DialogFooter>
              <Button type="button" onClick={() => { resetForm(); onOpenChange(false); }}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <FormField label={t('users.invite_form.email')} htmlFor="iu-email" error={errors.email} required>
              <Input id="iu-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder={t('users.invite_form.emailPlaceholder')} />
            </FormField>

            <FormSelect label={t('users.invite_form.role')} name="role" value={form.role} onChange={handleSelect} options={roleOptions} />

            {restorableUserId ? (
              <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 mt-3">
                <p className="text-body text-foreground mb-3">{t('users.invite_form.restorablePrompt')}</p>
                <Button type="button" size="sm" onClick={handleRestore} disabled={restoreRecord.isPending}>
                  {restoreRecord.isPending ? t('common.loading') : t('users.invite_form.restoreButton')}
                </Button>
              </div>
            ) : (
              inviteError && <p className="text-body text-danger mt-3 mb-1">{inviteError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => { resetForm(); onOpenChange(false); }}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={inviteUser.isPending}>
                <Mail className="w-4 h-4" />
                {inviteUser.isPending ? t('common.loading') : t('users.invite_form.send')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
