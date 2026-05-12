import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; role: string; password: string; preferredLanguage: string }) => {
      const res = await apiClient.post('/users', data);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create user');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { t } = useTranslation();
  const createUser = useCreateUser();

  const emptyForm = { firstName: '', lastName: '', email: '', role: 'teacher', password: '', preferredLanguage: 'fr' };
  const [form, setForm] = React.useState(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [createError, setCreateError] = React.useState<string | null>(null);

  function resetForm() {
    setForm(emptyForm);
    setErrors({});
    setCreateError(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) newErrors.firstName = t('users.invite_form.firstNameRequired');
    if (!form.lastName.trim()) newErrors.lastName = t('users.invite_form.lastNameRequired');
    if (!form.email.trim()) newErrors.email = t('users.invite_form.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = t('users.invite_form.emailInvalid');
    if (!form.password || form.password.length < 8) newErrors.password = t('users.create_form.passwordMin');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setCreateError(null);
    try {
      await createUser.mutateAsync(form);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const roleOptions = [
    { value: 'teacher', label: t('users.roles.teacher') },
    { value: 'parent', label: t('users.roles.parent') },
    { value: 'admin', label: t('users.roles.admin') },
  ];

  const langOptions = [
    { value: 'fr', label: 'Français' },
    { value: 'ar', label: 'العربية' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.create_form.title')}</DialogTitle>
          <DialogDescription>{t('users.create_form.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('users.invite_form.firstName')} htmlFor="cu-first" error={errors.firstName} required>
              <Input id="cu-first" name="firstName" value={form.firstName} onChange={handleChange} placeholder={t('users.invite_form.firstNamePlaceholder')} />
            </FormField>
            <FormField label={t('users.invite_form.lastName')} htmlFor="cu-last" error={errors.lastName} required>
              <Input id="cu-last" name="lastName" value={form.lastName} onChange={handleChange} placeholder={t('users.invite_form.lastNamePlaceholder')} />
            </FormField>
          </div>

          <FormField label={t('users.invite_form.email')} htmlFor="cu-email" error={errors.email} required>
            <Input id="cu-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder={t('users.invite_form.emailPlaceholder')} />
          </FormField>

          <FormField label={t('users.create_form.password')} htmlFor="cu-pwd" error={errors.password} required>
            <Input id="cu-pwd" name="password" type="password" value={form.password} onChange={handleChange} placeholder={t('users.create_form.passwordPlaceholder')} />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormSelect label={t('users.invite_form.role')} name="role" value={form.role} onChange={handleSelect} options={roleOptions} />
            <FormSelect label={t('users.columns.language')} name="preferredLanguage" value={form.preferredLanguage} onChange={handleSelect} options={langOptions} />
          </div>

          {createError && <p className="text-body text-danger mb-4">{createError}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => { resetForm(); onOpenChange(false); }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              <UserPlus className="w-4 h-4" />
              {createUser.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
