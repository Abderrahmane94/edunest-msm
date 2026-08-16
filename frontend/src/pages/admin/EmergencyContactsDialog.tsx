import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input, StatusBadge,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import {
  useEmergencyContacts, useAddEmergencyContact, useUpdateEmergencyContact, useRemoveEmergencyContact,
  type EmergencyContact,
} from '@/hooks/useChildren';

const PHONE_PATTERN = /^\+?[0-9\s\-().]{6,50}$/;

const RELATIONSHIP_VALUES = [
  'mother', 'father', 'grandmother', 'grandfather', 'sibling', 'uncleAunt', 'guardian', 'familyFriend', 'neighbor',
] as const;

interface ContactFormState {
  name: string;
  relationshipOption: string;
  relationshipOther: string;
  phone: string;
  is_authorized_pickup: boolean;
}

const emptyForm: ContactFormState = {
  name: '', relationshipOption: 'mother', relationshipOther: '', phone: '', is_authorized_pickup: false,
};

interface EmergencyContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  childName: string;
}

export function EmergencyContactsDialog({ open, onOpenChange, childId, childName }: EmergencyContactsDialogProps) {
  const { t } = useTranslation();
  const { data: contacts = [], isLoading: contactsLoading } = useEmergencyContacts(childId);
  const addContact = useAddEmergencyContact();
  const updateContact = useUpdateEmergencyContact();
  const removeContact = useRemoveEmergencyContact();

  const relationshipOptions = [
    ...RELATIONSHIP_VALUES.map((v) => ({ value: v, label: t(`children.emergencyContacts.relationships.${v}`) })),
    { value: 'other', label: t('children.emergencyContacts.relationships.other') },
  ];

  // Maps a stored relationship string back to a preset value (for editing), or 'other' with the raw text preserved.
  function relationshipToForm(relationship: string): { option: string; other: string } {
    const match = RELATIONSHIP_VALUES.find((v) => t(`children.emergencyContacts.relationships.${v}`) === relationship);
    return match ? { option: match, other: '' } : { option: 'other', other: relationship };
  }

  function resolveRelationship(form: ContactFormState): string {
    return form.relationshipOption === 'other'
      ? form.relationshipOther.trim()
      : t(`children.emergencyContacts.relationships.${form.relationshipOption}`);
  }

  const [newContact, setNewContact] = React.useState<ContactFormState>(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<ContactFormState>(emptyForm);
  const [editErrors, setEditErrors] = React.useState<Record<string, string>>({});
  const [editError, setEditError] = React.useState<string | null>(null);

  function validate(form: ContactFormState): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('children.emergencyContacts.nameRequired');
    if (form.relationshipOption === 'other' && !form.relationshipOther.trim()) {
      errs.relationship = t('children.emergencyContacts.relationshipRequired');
    }
    if (!form.phone.trim()) {
      errs.phone = t('children.emergencyContacts.phoneRequired');
    } else if (!PHONE_PATTERN.test(form.phone.trim())) {
      errs.phone = t('children.emergencyContacts.phoneInvalid');
    }
    return errs;
  }

  async function handleAddContact() {
    const errs = validate(newContact);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitError(null);
    try {
      await addContact.mutateAsync({
        childId,
        name: newContact.name.trim(),
        relationship: resolveRelationship(newContact),
        phone: newContact.phone.trim(),
        is_authorized_pickup: newContact.is_authorized_pickup,
      });
      setNewContact(emptyForm);
      setErrors({});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleRemoveContact(contactId: string) {
    try {
      await removeContact.mutateAsync({ childId, contactId });
    } catch {
      // Surfaced via removeContact.isError below if needed
    }
  }

  function startEdit(contact: EmergencyContact) {
    const { option, other } = relationshipToForm(contact.relationship);
    setEditingId(contact.id);
    setEditForm({ name: contact.name, relationshipOption: option, relationshipOther: other, phone: contact.phone, is_authorized_pickup: contact.is_authorized_pickup });
    setEditErrors({});
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErrors({});
    setEditError(null);
  }

  async function handleSaveEdit(contactId: string) {
    const errs = validate(editForm);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setEditError(null);
    try {
      await updateContact.mutateAsync({
        childId,
        contactId,
        name: editForm.name.trim(),
        relationship: resolveRelationship(editForm),
        phone: editForm.phone.trim(),
        is_authorized_pickup: editForm.is_authorized_pickup,
      });
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const hasAuthorizedPickup = contacts.some((c) => c.is_authorized_pickup);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('children.emergencyContacts.title')}</DialogTitle>
          <DialogDescription>
            {t('children.emergencyContacts.description', { name: childName })}
          </DialogDescription>
        </DialogHeader>

        {contactsLoading && (
          <p className="text-caption text-text-secondary mb-4">{t('common.loading')}</p>
        )}

        {!contactsLoading && contacts.length === 0 && (
          <p className="text-body text-text-secondary mb-4">{t('children.emergencyContacts.noContacts')}</p>
        )}

        {!contactsLoading && contacts.length > 0 && !hasAuthorizedPickup && (
          <div className="mb-4">
            <StatusBadge variant="absent">{t('children.emergencyContacts.noPickupContact')}</StatusBadge>
          </div>
        )}

        {contacts.length > 0 && (
          <div className="space-y-2 mb-4">
            {contacts.map((contact) => (
              editingId === contact.id ? (
                <div key={contact.id} className="p-3 bg-subtle rounded-md space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <FormField label={t('children.emergencyContacts.name')} htmlFor={`ec-edit-name-${contact.id}`} error={editErrors.name} required>
                      <Input
                        id={`ec-edit-name-${contact.id}`}
                        value={editForm.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </FormField>
                    <FormSelect
                      label={t('children.emergencyContacts.relationship')}
                      name={`ec-edit-rel-${contact.id}`}
                      value={editForm.relationshipOption}
                      onChange={(e) => setEditForm((p) => ({ ...p, relationshipOption: e.target.value }))}
                      options={relationshipOptions}
                    />
                  </div>
                  {editForm.relationshipOption === 'other' && (
                    <FormField label={t('children.emergencyContacts.relationshipOther')} htmlFor={`ec-edit-rel-other-${contact.id}`} error={editErrors.relationship} required>
                      <Input
                        id={`ec-edit-rel-other-${contact.id}`}
                        value={editForm.relationshipOther}
                        onChange={(e) => setEditForm((p) => ({ ...p, relationshipOther: e.target.value }))}
                        placeholder={t('children.emergencyContacts.relationshipOtherPlaceholder')}
                      />
                    </FormField>
                  )}
                  <FormField label={t('children.emergencyContacts.phone')} htmlFor={`ec-edit-phone-${contact.id}`} error={editErrors.phone} required>
                    <Input
                      id={`ec-edit-phone-${contact.id}`}
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </FormField>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_authorized_pickup}
                      onChange={(e) => setEditForm((p) => ({ ...p, is_authorized_pickup: e.target.checked }))}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-body text-foreground">{t('children.emergencyContacts.authorizedPickup')}</span>
                  </label>
                  {editError && <p className="text-body text-danger">{editError}</p>}
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => handleSaveEdit(contact.id)} disabled={updateContact.isPending}>
                      <Check className="w-4 h-4" />
                      {t('children.emergencyContacts.save')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-subtle rounded-md">
                  <div>
                    <p className="text-body font-medium text-foreground">{contact.name}</p>
                    <p className="text-caption text-text-secondary">
                      {contact.relationship} • {contact.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.is_authorized_pickup && (
                      <StatusBadge variant="present">
                        {t('children.emergencyContacts.authorizedPickup')}
                      </StatusBadge>
                    )}
                    <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(contact)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRemoveContact(contact.id)}
                      disabled={removeContact.isPending}
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
            {t('children.emergencyContacts.addNew')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('children.emergencyContacts.name')}
              htmlFor="ec-name"
              error={errors.name}
              required
            >
              <Input
                id="ec-name"
                name="name"
                value={newContact.name}
                onChange={(e) => { setNewContact((p) => ({ ...p, name: e.target.value })); setErrors((p) => ({ ...p, name: '' })); }}
                placeholder={t('children.emergencyContacts.namePlaceholder')}
              />
            </FormField>

            <FormSelect
              label={t('children.emergencyContacts.relationship')}
              name="relationshipOption"
              value={newContact.relationshipOption}
              onChange={(e) => setNewContact((p) => ({ ...p, relationshipOption: e.target.value }))}
              options={relationshipOptions}
            />
          </div>

          {newContact.relationshipOption === 'other' && (
            <FormField
              label={t('children.emergencyContacts.relationshipOther')}
              htmlFor="ec-relationship-other"
              error={errors.relationship}
              required
            >
              <Input
                id="ec-relationship-other"
                value={newContact.relationshipOther}
                onChange={(e) => { setNewContact((p) => ({ ...p, relationshipOther: e.target.value })); setErrors((p) => ({ ...p, relationship: '' })); }}
                placeholder={t('children.emergencyContacts.relationshipOtherPlaceholder')}
              />
            </FormField>
          )}

          <FormField
            label={t('children.emergencyContacts.phone')}
            htmlFor="ec-phone"
            error={errors.phone}
            required
          >
            <Input
              id="ec-phone"
              name="phone"
              type="tel"
              value={newContact.phone}
              onChange={(e) => { setNewContact((p) => ({ ...p, phone: e.target.value })); setErrors((p) => ({ ...p, phone: '' })); }}
              placeholder="+213 XX XX XX XX"
            />
          </FormField>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_authorized_pickup"
              checked={newContact.is_authorized_pickup}
              onChange={(e) => setNewContact((p) => ({ ...p, is_authorized_pickup: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-body text-foreground">
              {t('children.emergencyContacts.authorizedPickup')}
            </span>
          </label>

          {submitError && <p className="text-body text-danger">{submitError}</p>}

          <Button type="button" variant="secondary" size="sm" onClick={handleAddContact} disabled={addContact.isPending}>
            <Plus className="w-4 h-4" />
            {addContact.isPending ? t('common.loading') : t('children.emergencyContacts.add')}
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
