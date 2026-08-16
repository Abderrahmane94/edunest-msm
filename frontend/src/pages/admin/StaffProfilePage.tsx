import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Download, Trash2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import { useUser } from '@/hooks/useUsers';
import {
  useStaffProfileByUserId,
  useCreateStaffProfile,
  useUpdateStaffProfile,
  useUploadStaffDocument,
  useDeleteStaffDocument,
  openStaffDocument,
  type ContractType,
} from '@/hooks/useStaff';

export function StaffProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  const { data: user, isLoading: userLoading } = useUser(userId!);
  const { data: profile, isLoading: profileLoading } = useStaffProfileByUserId(userId!);
  const createProfile = useCreateStaffProfile();
  const updateProfile = useUpdateStaffProfile();
  const uploadDocument = useUploadStaffDocument();
  const deleteDocument = useDeleteStaffDocument();

  const [formData, setFormData] = React.useState({
    position: '',
    contract_type: 'full_time' as ContractType,
    contract_start: '',
    contract_end: '',
  });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [documentError, setDocumentError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (profile) {
      setFormData({
        position: profile.position,
        contract_type: profile.contract_type,
        contract_start: profile.contract_start?.split('T')[0] ?? '',
        contract_end: profile.contract_end?.split('T')[0] ?? '',
      });
    }
  }, [profile]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value as ContractType }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);

    try {
      if (profile) {
        await updateProfile.mutateAsync({ profileId: profile.id, userId: userId!, data: formData });
      } else {
        await createProfile.mutateAsync({ user_id: userId!, ...formData });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setDocumentError(null);
    try {
      await uploadDocument.mutateAsync({ profileId: profile.id, userId: userId!, file });
    } catch (err) {
      setDocumentError(err instanceof Error ? err.message : t('common.error'));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleDeleteDocument() {
    if (!profile) return;
    setDocumentError(null);
    try {
      await deleteDocument.mutateAsync({ profileId: profile.id, userId: userId! });
    } catch (err) {
      setDocumentError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleDownloadDocument() {
    if (!profile) return;
    setDocumentError(null);
    setDownloading(true);
    try {
      await openStaffDocument(profile.id);
    } catch (err) {
      setDocumentError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setDownloading(false);
    }
  }

  const contractTypeOptions = [
    { value: 'full_time', label: t('staff.contractTypes.full_time') },
    { value: 'part_time', label: t('staff.contractTypes.part_time') },
    { value: 'contract', label: t('staff.contractTypes.contract') },
  ];

  const isLoading = userLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('staff.profile')}
        </h1>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-14 w-14 rounded-full bg-hover" />
            <div className="h-10 bg-hover rounded-md w-1/3" />
            <div className="h-10 bg-hover rounded-md w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/staff')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('staff.notFound')}</p>
      </div>
    );
  }

  const isSaving = createProfile.isPending || updateProfile.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/staff')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <div className="w-14 h-14 rounded-full bg-[var(--color-accent-muted)] text-primary flex items-center justify-center shrink-0">
          <UserCog className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-page-title font-semibold text-text-heading">
            {user.first_name} {user.last_name}
          </h1>
          <p className="text-body text-text-secondary">{profile?.position || t('staff.noPosition')}</p>
        </div>
      </div>

      {!profile && (
        <p className="text-body text-warning bg-warning-muted rounded-lg px-4 py-2">
          {t('staff.noProfileYet')}
        </p>
      )}

      {/* Contract Details Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-subsection font-semibold text-text-heading mb-4">
            {t('staff.contractDetails')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <FormField label={t('staff.position')} htmlFor="position" required>
              <Input
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder={t('staff.positionPlaceholder')}
              />
            </FormField>

            <FormSelect
              label={t('staff.contractType')}
              name="contract_type"
              value={formData.contract_type}
              onChange={handleSelectChange}
              options={contractTypeOptions}
            />

            <FormField label={t('staff.contractStart')} htmlFor="contract_start" required>
              <Input
                id="contract_start"
                name="contract_start"
                type="date"
                value={formData.contract_start}
                onChange={handleChange}
              />
            </FormField>

            <FormField label={t('staff.contractEnd')} htmlFor="contract_end">
              <Input
                id="contract_end"
                name="contract_end"
                type="date"
                value={formData.contract_end}
                onChange={handleChange}
              />
            </FormField>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t('common.loading') : profile ? t('common.save') : t('staff.createProfile')}
            </Button>
            {saveSuccess && (
              <span className="text-body text-success animate-fade-in">
                {t('staff.saved')}
              </span>
            )}
            {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
          </div>
        </div>
      </form>

      {/* Documents Section — only once a profile exists to attach the document to */}
      {profile && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-subsection font-semibold text-text-heading">
              {t('staff.documents')}
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUploadClick}
              disabled={uploadDocument.isPending}
            >
              <Upload className="w-4 h-4" />
              {uploadDocument.isPending
                ? t('common.loading')
                : profile.document_public_id
                  ? t('staff.replaceDocument')
                  : t('staff.uploadDocument')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              className="hidden"
              aria-hidden="true"
            />
          </div>

          {documentError && <p className="text-body text-danger mb-3">{documentError}</p>}

          {!profile.document_public_id ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-text-disabled mx-auto mb-2" />
              <p className="text-body text-text-secondary">
                {t('staff.noDocuments')}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-md border border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-subtle flex items-center justify-center">
                  <FileText className="w-4 h-4 text-text-secondary" />
                </div>
                <p className="text-body font-medium text-foreground">
                  {t('staff.contractDocument')}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownloadDocument}
                  disabled={downloading}
                  aria-label={t('staff.downloadDocument')}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteDocument}
                  disabled={deleteDocument.isPending}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="w-4 h-4 text-danger" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
