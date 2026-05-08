import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Upload, FileText, Download, Trash2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui';
import { FormField } from '@/components/forms';
import { FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import { useStaffProfile, useUpdateStaffProfile, useStaffDocuments, useUploadStaffDocument, useDeleteStaffDocument } from '@/hooks/useStaff';

export function StaffProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const { data: profile, isLoading } = useStaffProfile(userId!);
  const updateProfile = useUpdateStaffProfile();
  const { data: documents = [] } = useStaffDocuments(userId!);
  const uploadDocument = useUploadStaffDocument();
  const deleteDocument = useDeleteStaffDocument();

  const [formData, setFormData] = React.useState({
    position: '',
    contract_type: 'full_time',
    contract_start: '',
    contract_end: '',
  });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (profile) {
      setFormData({
        position: profile.position || '',
        contract_type: profile.contract_type || 'full_time',
        contract_start: profile.contract_start?.split('T')[0] || '',
        contract_end: profile.contract_end?.split('T')[0] || '',
      });
    }
  }, [profile]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);

    try {
      await updateProfile.mutateAsync({
        userId: userId!,
        data: formData,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by React Query
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    try {
      await uploadDocument.mutateAsync({ userId, file });
    } catch {
      // Error handled by React Query
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!userId) return;
    try {
      await deleteDocument.mutateAsync({ userId, documentId });
    } catch {
      // Error handled by React Query
    }
  }

  const contractTypeOptions = [
    { value: 'full_time', label: t('staff.contractTypes.full_time') },
    { value: 'part_time', label: t('staff.contractTypes.part_time') },
    { value: 'contract', label: t('staff.contractTypes.contract') },
  ];

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-[var(--color-accent-muted)] text-primary flex items-center justify-center">
          <UserCog className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-page-title font-semibold text-text-heading">
            {profile?.user?.first_name} {profile?.user?.last_name}
          </h1>
          <p className="text-body text-text-secondary">{profile?.position || t('staff.noPosition')}</p>
        </div>
      </div>

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
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? t('common.loading') : t('common.save')}
            </Button>
            {saveSuccess && (
              <span className="text-body text-success animate-fade-in">
                {t('staff.saved')}
              </span>
            )}
          </div>
        </div>
      </form>

      {/* Documents Section */}
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
            {t('staff.uploadDocument')}
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

        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-text-disabled mx-auto mb-2" />
            <p className="text-body text-text-secondary">
              {t('staff.noDocuments')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-hover transition-colors duration-150"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-subtle flex items-center justify-center">
                    <FileText className="w-4 h-4 text-text-secondary" />
                  </div>
                  <div>
                    <p className="text-body font-medium text-foreground">
                      {doc.name}
                    </p>
                    <p className="text-caption text-text-secondary">
                      {t('staff.uploadedOn', { date: new Date(doc.uploaded_at).toLocaleDateString() })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {doc.signed_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                    >
                      <a
                        href={doc.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('staff.downloadDocument')}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteDocument(doc.id)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4 text-danger" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
