import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { FormSelect } from '@/components/forms';
import { useInviteUser } from '@/hooks/useUsers';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { t } = useTranslation();
  const inviteUser = useInviteUser();

  const [formData, setFormData] = React.useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'teacher',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function resetForm() {
    setFormData({ email: '', first_name: '', last_name: '', role: 'teacher' });
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

    if (!formData.email.trim()) {
      newErrors.email = t('users.invite_form.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('users.invite_form.emailInvalid');
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = t('users.invite_form.firstNameRequired');
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = t('users.invite_form.lastNameRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    try {
      await inviteUser.mutateAsync(formData);
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by React Query
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  }

  const roleOptions = [
    { value: 'teacher', label: t('users.roles.teacher') },
    { value: 'parent', label: t('users.roles.parent') },
    { value: 'admin', label: t('users.roles.admin') },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.invite_form.title')}</DialogTitle>
          <DialogDescription>
            {t('users.invite_form.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('users.invite_form.firstName')}
              htmlFor="invite-first-name"
              error={errors.first_name}
              required
            >
              <Input
                id="invite-first-name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder={t('users.invite_form.firstNamePlaceholder')}
              />
            </FormField>

            <FormField
              label={t('users.invite_form.lastName')}
              htmlFor="invite-last-name"
              error={errors.last_name}
              required
            >
              <Input
                id="invite-last-name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder={t('users.invite_form.lastNamePlaceholder')}
              />
            </FormField>
          </div>

          <FormField
            label={t('users.invite_form.email')}
            htmlFor="invite-email"
            error={errors.email}
            required
          >
            <Input
              id="invite-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('users.invite_form.emailPlaceholder')}
            />
          </FormField>

          <FormSelect
            label={t('users.invite_form.role')}
            name="role"
            value={formData.role}
            onChange={handleSelectChange}
            options={roleOptions}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={inviteUser.isPending}>
              <Mail className="w-4 h-4" />
              {inviteUser.isPending
                ? t('common.loading')
                : t('users.invite_form.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
