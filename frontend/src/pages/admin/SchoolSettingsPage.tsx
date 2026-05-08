import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Upload, Camera } from 'lucide-react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { FormField } from '@/components/forms';
import { FormSelect } from '@/components/forms';
import { useSchool, useUpdateSchool } from '@/hooks/useSchool';

export function SchoolSettingsPage() {
  const { t } = useTranslation();
  const { data: school, isLoading } = useSchool();
  const updateSchool = useUpdateSchool();

  const [formData, setFormData] = React.useState({
    name: '',
    school_type: 'kindergarten',
    address: '',
    wilaya: '',
    contact_email: '',
    contact_phone: '',
  });
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (school) {
      setFormData({
        name: school.name || '',
        school_type: school.school_type || 'kindergarten',
        address: school.address || '',
        wilaya: school.wilaya || '',
        contact_email: school.contact_email || '',
        contact_phone: school.contact_phone || '',
      });
      if (school.logo_url) {
        setLogoPreview(school.logo_url);
      }
    }
  }, [school]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleLogoClick() {
    fileInputRef.current?.click();
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogoPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);

    try {
      await updateSchool.mutateAsync(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by React Query
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('schoolSettings.title')}
        </h1>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-20 w-20 rounded-full bg-hover" />
            <div className="h-10 bg-hover rounded-md w-1/2" />
            <div className="h-10 bg-hover rounded-md w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  const schoolTypeOptions = [
    { value: 'kindergarten', label: t('schoolSettings.types.kindergarten') },
    { value: 'primary', label: t('schoolSettings.types.primary') },
    { value: 'secondary', label: t('schoolSettings.types.secondary') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-page-title font-semibold text-text-heading">
        {t('schoolSettings.title')}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo Upload Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-subsection font-semibold text-text-heading mb-4">
            {t('schoolSettings.logo')}
          </h2>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleLogoClick}
              className="relative w-20 h-20 rounded-full bg-subtle border-2 border-dashed border-border-strong flex items-center justify-center overflow-hidden hover:border-primary transition-colors duration-150 cursor-pointer group"
              aria-label={t('schoolSettings.uploadLogo')}
            >
              {logoPreview ? (
                <>
                  <img
                    src={logoPreview}
                    alt={t('schoolSettings.logoAlt')}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[rgba(15,23,42,0.5)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-[var(--color-text-inverse)]" />
                  </div>
                </>
              ) : (
                <Building2 className="w-8 h-8 text-text-secondary" />
              )}
            </button>

            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleLogoClick}
              >
                <Upload className="w-4 h-4" />
                {t('schoolSettings.uploadLogo')}
              </Button>
              <p className="text-caption text-text-secondary">
                {t('schoolSettings.logoHint')}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoChange}
              className="hidden"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* School Details */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-subsection font-semibold text-text-heading mb-4">
            {t('schoolSettings.details')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <FormField label={t('schoolSettings.name')} htmlFor="name" required>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={t('schoolSettings.namePlaceholder')}
              />
            </FormField>

            <FormSelect
              label={t('schoolSettings.type')}
              name="school_type"
              value={formData.school_type}
              onChange={handleSelectChange}
              options={schoolTypeOptions}
            />

            <FormField label={t('schoolSettings.address')} htmlFor="address" required>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder={t('schoolSettings.addressPlaceholder')}
              />
            </FormField>

            <FormField label={t('schoolSettings.wilaya')} htmlFor="wilaya" required>
              <Input
                id="wilaya"
                name="wilaya"
                value={formData.wilaya}
                onChange={handleChange}
                placeholder={t('schoolSettings.wilayaPlaceholder')}
              />
            </FormField>

            <FormField label={t('schoolSettings.contactEmail')} htmlFor="contact_email" required>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={handleChange}
                placeholder={t('schoolSettings.contactEmailPlaceholder')}
              />
            </FormField>

            <FormField label={t('schoolSettings.contactPhone')} htmlFor="contact_phone" required>
              <Input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={handleChange}
                placeholder={t('schoolSettings.contactPhonePlaceholder')}
              />
            </FormField>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={updateSchool.isPending}>
            {updateSchool.isPending ? t('common.loading') : t('common.save')}
          </Button>

          {saveSuccess && (
            <span className="text-body text-success animate-fade-in">
              {t('schoolSettings.saved')}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
