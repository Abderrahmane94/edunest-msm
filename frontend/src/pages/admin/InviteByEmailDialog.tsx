import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { useInviteUser } from '@/hooks/useUsers';

interface InviteByEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteByEmailDialog({ open, onOpenChange }: InviteByEmailDialogProps) {
  const { t } = useTranslation();
  const inviteUser = useInviteUser();

  const emptyForm = { email: '', role: 'teacher' };
  const [form, setForm] = React.useState(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  function resetForm() {
    setForm(emptyForm);
    setErrors({});
    setInviteError(null);
    setIsSuccess(false);
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
    try {
      await inviteUser.mutateAsync({ email: form.email, role: form.role });
      setIsSuccess(true);
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

            {inviteError && <p className="text-body text-danger mt-3 mb-1">{inviteError}</p>}

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
