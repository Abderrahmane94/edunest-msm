import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Building2, Power, PowerOff, Pencil } from 'lucide-react';
import {
  Button,
  DataTable,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface School {
  id: string;
  name: string;
  schoolType: string;
  address: string;
  wilaya: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
}

function useSchools() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['schools-list'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/schools');
      const raw = res.data;
      if (Array.isArray(raw)) return raw as School[];
      if (raw && typeof raw === 'object' && 'schools' in (raw as object)) {
        return (raw as { schools: School[] }).schools;
      }
      return [];
    },
    enabled: user?.role === 'super_admin',
  });
}

function useCreateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      schoolType: string;
      address: string;
      wilaya: string;
      contactEmail: string;
      contactPhone: string;
    }) => {
      const res = await apiClient.post('/schools', data);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create school');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools-list'] });
    },
  });
}

function useUpdateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<School> }) => {
      const res = await apiClient.put(`/schools/${id}`, data);
      if (!res.success) throw new Error(res.error?.message || 'Failed to update school');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools-list'] });
    },
  });
}

function useToggleSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schoolId: string) => {
      const res = await apiClient.patch(`/schools/${schoolId}/deactivate`);
      if (!res.success) throw new Error(res.error?.message || 'Failed to update school');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools-list'] });
    },
  });
}

export function SchoolsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: schools, isLoading } = useSchools();
  const toggleSchool = useToggleSchool();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editSchool, setEditSchool] = React.useState<School | null>(null);

  // Only super_admin can access this page
  if (user?.role !== 'super_admin') {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-page-title font-semibold text-text-heading">
          Gestion des écoles
        </h1>
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-body text-text-secondary">
            Accès réservé au super administrateur.
          </p>
        </div>
      </div>
    );
  }

  const columns: Column<School>[] = [
    {
      key: 'name',
      header: 'Nom',
      sortable: true,
      render: (school) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-muted)] text-primary flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-body font-medium text-foreground">{school.name}</p>
            <p className="text-caption text-text-secondary">{school.wilaya}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'schoolType',
      header: 'Type',
      render: (school) => (
        <StatusBadge variant="sent">
          {school.schoolType === 'kindergarten' ? 'Maternelle' :
           school.schoolType === 'primary' ? 'Primaire' : 'Secondaire'}
        </StatusBadge>
      ),
    },
    {
      key: 'contactEmail',
      header: 'Contact',
      render: (school) => (
        <div>
          <p className="text-body text-foreground">{school.contactEmail}</p>
          <p className="text-caption text-text-secondary">{school.contactPhone}</p>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Statut',
      render: (school) => (
        <StatusBadge variant={school.isActive ? 'present' : 'cancelled'}>
          {school.isActive ? 'Active' : 'Désactivée'}
        </StatusBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Créée le',
      render: (school) => (
        <span className="text-caption text-text-secondary">
          {new Date(school.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (school) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditSchool(school)}
            aria-label="Modifier"
          >
            <Pencil className="w-4 h-4 text-text-secondary" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSchool.mutate(school.id)}
            disabled={toggleSchool.isPending}
            aria-label={school.isActive ? 'Désactiver' : 'Activer'}
          >
            {school.isActive ? (
              <PowerOff className="w-4 h-4 text-danger" />
            ) : (
              <Power className="w-4 h-4 text-success" />
            )}
          </Button>
        </div>
      ),
      className: 'w-24',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-page-title font-semibold text-text-heading">
          Gestion des écoles
        </h1>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-text-heading">
          Gestion des écoles
        </h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle école
        </Button>
      </div>

      <DataTable<School>
        columns={columns}
        data={schools ?? []}
        keyExtractor={(s) => s.id}
        emptyMessage="Aucune école enregistrée"
      />

      <CreateSchoolDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <EditSchoolDialog
        open={!!editSchool}
        onOpenChange={(open) => { if (!open) setEditSchool(null); }}
        school={editSchool}
      />
    </div>
  );
}

function CreateSchoolDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createSchool = useCreateSchool();
  const [formData, setFormData] = React.useState({
    name: '',
    schoolType: 'kindergarten',
    address: '',
    wilaya: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function resetForm() {
    setFormData({ name: '', schoolType: 'kindergarten', address: '', wilaya: '', contactEmail: '', contactPhone: '' });
    setErrors({});
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Le nom est requis';
    if (!formData.address.trim()) newErrors.address = "L'adresse est requise";
    if (!formData.wilaya.trim()) newErrors.wilaya = 'La wilaya est requise';
    if (!formData.contactEmail.trim()) newErrors.contactEmail = "L'email est requis";
    if (!formData.contactPhone.trim()) newErrors.contactPhone = 'Le téléphone est requis';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createSchool.mutateAsync(formData);
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  const typeOptions = [
    { value: 'kindergarten', label: 'Maternelle' },
    { value: 'primary', label: 'Primaire' },
    { value: 'secondary', label: 'Secondaire' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Créer une école</DialogTitle>
          <DialogDescription>
            Enregistrez un nouvel établissement sur la plateforme.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormField label="Nom de l'école" htmlFor="school-name" error={errors.name} required>
            <Input
              id="school-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Maternelle An-Nour"
            />
          </FormField>

          <FormSelect
            label="Type d'établissement"
            name="schoolType"
            value={formData.schoolType}
            onChange={handleSelectChange}
            options={typeOptions}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label="Adresse" htmlFor="school-address" error={errors.address} required>
              <Input
                id="school-address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="12 Rue..."
              />
            </FormField>

            <FormField label="Wilaya" htmlFor="school-wilaya" error={errors.wilaya} required>
              <Input
                id="school-wilaya"
                name="wilaya"
                value={formData.wilaya}
                onChange={handleChange}
                placeholder="Alger"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label="Email de contact" htmlFor="school-email" error={errors.contactEmail} required>
              <Input
                id="school-email"
                name="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={handleChange}
                placeholder="contact@ecole.dz"
              />
            </FormField>

            <FormField label="Téléphone" htmlFor="school-phone" error={errors.contactPhone} required>
              <Input
                id="school-phone"
                name="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={handleChange}
                placeholder="+213 XX XX XX XX"
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createSchool.isPending}>
              {createSchool.isPending ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function EditSchoolDialog({
  open,
  onOpenChange,
  school,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: School | null;
}) {
  const updateSchool = useUpdateSchool();
  const [formData, setFormData] = React.useState({
    name: '',
    schoolType: 'kindergarten',
    address: '',
    wilaya: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // Populate form when school changes
  React.useEffect(() => {
    if (school) {
      setFormData({
        name: school.name,
        schoolType: school.schoolType,
        address: school.address,
        wilaya: school.wilaya,
        contactEmail: school.contactEmail,
        contactPhone: school.contactPhone,
      });
      setSaveSuccess(false);
    }
  }, [school]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setSaveSuccess(false);
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaveSuccess(false);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Le nom est requis';
    if (!formData.address.trim()) newErrors.address = "L'adresse est requise";
    if (!formData.wilaya.trim()) newErrors.wilaya = 'La wilaya est requise';
    if (!formData.contactEmail.trim()) newErrors.contactEmail = "L'email est requis";
    if (!formData.contactPhone.trim()) newErrors.contactPhone = 'Le téléphone est requis';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !school) return;

    try {
      await updateSchool.mutateAsync({ id: school.id, data: formData });
      setSaveSuccess(true);
      setTimeout(() => onOpenChange(false), 1000);
    } catch {
      // Error handled by mutation
    }
  }

  const typeOptions = [
    { value: 'kindergarten', label: 'Maternelle' },
    { value: 'primary', label: 'Primaire' },
    { value: 'secondary', label: 'Secondaire' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Détails de l'école</DialogTitle>
          <DialogDescription>
            Consultez et modifiez les informations de l'établissement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormField label="Nom de l'école" htmlFor="edit-school-name" error={errors.name} required>
            <Input
              id="edit-school-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Maternelle An-Nour"
            />
          </FormField>

          <FormSelect
            label="Type d'établissement"
            name="schoolType"
            value={formData.schoolType}
            onChange={handleSelectChange}
            options={typeOptions}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label="Adresse" htmlFor="edit-school-address" error={errors.address} required>
              <Input
                id="edit-school-address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="12 Rue..."
              />
            </FormField>

            <FormField label="Wilaya" htmlFor="edit-school-wilaya" error={errors.wilaya} required>
              <Input
                id="edit-school-wilaya"
                name="wilaya"
                value={formData.wilaya}
                onChange={handleChange}
                placeholder="Alger"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label="Email de contact" htmlFor="edit-school-email" error={errors.contactEmail} required>
              <Input
                id="edit-school-email"
                name="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={handleChange}
                placeholder="contact@ecole.dz"
              />
            </FormField>

            <FormField label="Téléphone" htmlFor="edit-school-phone" error={errors.contactPhone} required>
              <Input
                id="edit-school-phone"
                name="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={handleChange}
                placeholder="+213 XX XX XX XX"
              />
            </FormField>
          </div>

          {/* School metadata (read-only) */}
          {school && (
            <div className="mt-4 p-3 bg-subtle rounded-lg space-y-1">
              <p className="text-caption text-text-secondary">
                <span className="font-medium">ID:</span> {school.id}
              </p>
              <p className="text-caption text-text-secondary">
                <span className="font-medium">Créée le:</span> {new Date(school.createdAt).toLocaleDateString()}
              </p>
              <p className="text-caption text-text-secondary">
                <span className="font-medium">Statut:</span> {school.isActive ? 'Active' : 'Désactivée'}
              </p>
            </div>
          )}

          <DialogFooter>
            {saveSuccess && (
              <span className="text-body text-success me-auto">Modifications enregistrées ✓</span>
            )}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button type="submit" disabled={updateSchool.isPending}>
              {updateSchool.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
