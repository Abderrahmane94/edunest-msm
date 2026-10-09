import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Upload, Camera, GraduationCap, Clock, Trash2 } from 'lucide-react';
import {
  Button,
  EditButton,
  EditFormActions,
  PageHeader,
  ReadOnlyFieldset,
  Tabs,
  useEditMode,
} from '@/components/ui';
import { Input } from '@/components/ui';
import { FormField } from '@/components/forms';
import { useSchool, useUpdateSchool, useUploadSchoolLogo } from '@/hooks/useSchool';
import { useTabParam } from '@/hooks/useTabParam';
import { AcademicYearsSection } from './AcademicYearsPage';
import { TimetableSection } from './TimetablePage';
import { TrashPage } from './TrashPage';

type SettingsTab = 'school' | 'years' | 'days' | 'trash';
const SETTINGS_TABS: SettingsTab[] = ['school', 'years', 'days', 'trash'];

export function SchoolSettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useTabParam<SettingsTab>(SETTINGS_TABS, 'school');

  const tabs: { value: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { value: 'school', label: t('schoolSettings.tabs.school'), icon: <Building2 className="w-4 h-4" /> },
    { value: 'years', label: t('academicYears.title'), icon: <GraduationCap className="w-4 h-4" /> },
    { value: 'days', label: t('timetable.title'), icon: <Clock className="w-4 h-4" /> },
    { value: 'trash', label: t('trash.title'), icon: <Trash2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('schoolSettings.title')} />
      <Tabs value={activeTab} onChange={setActiveTab} items={tabs} />
      {activeTab === 'school' && <SchoolTab />}
      {activeTab === 'years' && <AcademicYearsSection />}
      {activeTab === 'days' && <TimetableSection />}
      {activeTab === 'trash' && <TrashPage embedded />}
    </div>
  );
}

/** Logo and contact details: read first, "Modifier" to change them. */
function SchoolTab() {
  const { t } = useTranslation();
  const { data: school, isLoading } = useSchool();
  const updateSchool = useUpdateSchool();
  const uploadLogo = useUploadSchoolLogo();

  const [selectedLogoFile, setSelectedLogoFile] = React.useState<File | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    address: '',
    wilaya: '',
    contact_email: '',
    contact_phone: '',
  });
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetToSaved = React.useCallback(() => {
    if (!school) return;
    setFormData({
      name: school.name || '',
      address: school.address || '',
      wilaya: school.wilaya || '',
      contact_email: school.contact_email || '',
      contact_phone: school.contact_phone || '',
    });
    setLogoPreview(school.logo_url ?? null);
    setSelectedLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [school]);
  const edit = useEditMode(() => {
    resetToSaved();
    setSaveError(null);
  });

  // Follow the saved school while reading; never overwrite what is being typed.
  React.useEffect(() => {
    if (!edit.editing) resetToSaved();
  }, [edit.editing, resetToSaved]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleLogoClick() {
    if (!edit.editing) return;
    fileInputRef.current?.click();
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedLogoFile(file);
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
    setSaveError(null);

    try {
      // Upload logo first if a new file was selected
      if (selectedLogoFile) {
        await uploadLogo.mutateAsync(selectedLogoFile);
        setSelectedLogoFile(null);
      }
      // Then save the school info
      await updateSchool.mutateAsync(formData);
      edit.finishEditing();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(errorMessage(err, t));
    }
  }

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-20 w-20 rounded-full bg-hover" />
          <div className="h-10 bg-hover rounded-md w-1/2" />
          <div className="h-10 bg-hover rounded-md w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Logo Upload Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-subsection font-semibold text-text-heading">
            {t('schoolSettings.logo')}
          </h2>
          <EditButton onClick={edit.startEditing} hidden={edit.editing} />
        </div>

        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={handleLogoClick}
            disabled={!edit.editing}
            className={
              edit.editing
                ? 'relative w-20 h-20 rounded-full bg-subtle border-2 border-dashed border-border-strong flex items-center justify-center overflow-hidden hover:border-primary transition-colors duration-150 cursor-pointer group'
                : 'relative w-20 h-20 rounded-full bg-subtle border border-border flex items-center justify-center overflow-hidden cursor-default'
            }
            aria-label={edit.editing ? t('schoolSettings.uploadLogo') : t('schoolSettings.logoAlt')}
          >
            {logoPreview ? (
              <>
                <img
                  src={logoPreview}
                  alt={t('schoolSettings.logoAlt')}
                  className="w-full h-full object-cover"
                />
                {edit.editing && (
                  <div className="absolute inset-0 bg-[rgba(15,23,42,0.5)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-[var(--color-text-inverse)]" />
                  </div>
                )}
              </>
            ) : (
              <Building2 className="w-8 h-8 text-text-secondary" />
            )}
          </button>

          {edit.editing && (
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
          )}

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

        <ReadOnlyFieldset readOnly={!edit.editing} className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormField label={t('schoolSettings.name')} htmlFor="name" required>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('schoolSettings.namePlaceholder')}
            />
          </FormField>

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
        </ReadOnlyFieldset>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {edit.editing && (
          <EditFormActions
            saving={updateSchool.isPending || uploadLogo.isPending}
            onCancel={edit.cancelEditing}
          />
        )}
        {edit.editing && selectedLogoFile && !saveSuccess && (
          <span className="text-caption text-text-secondary animate-fade-in">
            {t('schoolSettings.newLogoSelected')}
          </span>
        )}

        {saveSuccess && (
          <span className="text-body text-success animate-fade-in">
            {t('schoolSettings.saved')}
          </span>
        )}

        {saveError && (
          <span className="text-body text-danger animate-fade-in">
            {saveError}
          </span>
        )}
      </div>
    </form>
  );
}
