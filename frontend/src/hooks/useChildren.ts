import { everyPage, FULL_PAGE } from '@/lib/everyPage';
import { announceNewAccount, type CreatedAccount } from '@/lib/newAccount';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import { useYearScope } from './useSelectedYear';

export type BloodType = 'a_positive' | 'a_negative' | 'b_positive' | 'b_negative' | 'ab_positive' | 'ab_negative' | 'o_positive' | 'o_negative';

export interface Child {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  enrollment_date: string;
  photo_url?: string;
  is_active: boolean;
  classroom_name?: string;
  /** The class of the year being looked at (child file), or the first one. */
  classroom_id?: string;
  parent_names?: string[];
  national_id?: string | null;
  address?: string | null;
  place_of_birth?: string | null;
  blood_type?: BloodType | null;
  has_authorized_pickup?: boolean;
  /** How many health notes (allergy, treatment…) — lists only. */
  medical_note_count?: number;
  /** The years the child was registered, placed or billed, latest first (child file only). */
  school_years?: { id: string; name: string }[];
  /** What is still owed from the years before the one looked at (child file only). */
  unpaid_other_years?: { id: string; name: string; amount: string }[];
  created_at: string;
  deleted_at?: string | null;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  address?: string | null;
  national_id?: string | null;
  is_authorized_pickup: boolean;
}

export type MedicalNoteType = 'allergy' | 'condition' | 'medication';
export type MedicalNoteSeverity = 'low' | 'medium' | 'high';

export interface MedicalNote {
  id: string;
  type: MedicalNoteType;
  title: string;
  details: string | null;
  severity: MedicalNoteSeverity;
  created_at: string;
}

interface ChildrenParams {
  page?: number;
  pageSize?: number;
  /** Every matching child, however many (for pickers). */
  all?: boolean;
  /** Matches the child's and linked parents' names. */
  search?: string;
  classroomId?: string;
  gender?: 'male' | 'female';
  /** 'true': has a linked parent account; 'false': has none. */
  hasParent?: 'true' | 'false';
  status?: 'active' | 'inactive';
}

export function useChildren(params: ChildrenParams = {}) {
  const { page = 1, pageSize = 10, all = false, search, classroomId, gender, hasParent, status } = params;
  const { yearId, ready } = useYearScope();
  const queryParams = new URLSearchParams();
  if (yearId) queryParams.set('academic_year_id', yearId);
  if (search) queryParams.set('search', search);
  if (classroomId) queryParams.set('classroom_id', classroomId);
  if (gender) queryParams.set('gender', gender);
  if (hasParent) queryParams.set('has_parent', hasParent);
  if (status) queryParams.set('status', status);

  return useQuery({
    queryKey: ['children', params, yearId],
    enabled: ready,
    queryFn: async () => {
      const loadPage = async (pageNumber: number, size: number): Promise<{ children: Child[]; total: number }> => {
      queryParams.set('page', String(pageNumber));
      queryParams.set('pageSize', String(size));
      const res = await apiClient.get<unknown>(`/children?${queryParams.toString()}`);
      const raw = res.data;
      let children: Child[] = [];
      let total = 0;

      if (Array.isArray(raw)) {
        children = raw.map((c) => mapChild(c as Record<string, unknown>));
        total = (res.meta as { pagination?: { total?: number } })?.pagination?.total ?? children.length;
      } else if (raw && typeof raw === 'object' && 'children' in (raw as object)) {
        const wrapped = raw as { children: Record<string, unknown>[]; total: number };
        children = wrapped.children.map(mapChild);
        total = wrapped.total;
      }

      return { children, total };
      };
      if (!all) return loadPage(page, pageSize);
      const whole = await everyPage(async (pageNumber) => {
        const result = await loadPage(pageNumber, FULL_PAGE);
        return { items: result.children, total: result.total };
      });
      return { children: whole.items, total: whole.total };
    },
    // Keep the current list while a new page/filter loads (no flash, keeps the search box).
    placeholderData: (prev) => prev,
  });
}

function mapChild(raw: Record<string, unknown>): Child {
  const enrollments = raw.enrollments as { classroom?: { id?: string; name?: string } }[] | undefined;
  const classroomName = enrollments?.[0]?.classroom?.name;
  const classroomId = enrollments?.[0]?.classroom?.id;

  return {
    id: raw.id as string,
    first_name: (raw.firstName ?? raw.first_name) as string,
    last_name: (raw.lastName ?? raw.last_name) as string,
    date_of_birth: (raw.dateOfBirth ?? raw.date_of_birth) as string,
    gender: raw.gender as string,
    enrollment_date: (raw.enrollmentDate ?? raw.enrollment_date) as string,
    photo_url: (raw.photoPublicId ?? raw.photo_url) as string | undefined,
    is_active: (raw.isActive ?? raw.is_active) as boolean,
    classroom_name: classroomName,
    classroom_id: classroomId,
    parent_names: (raw.parentNames ?? raw.parent_names ?? []) as string[],
    national_id: (raw.nationalId ?? raw.national_id ?? null) as string | null,
    address: (raw.address ?? null) as string | null,
    place_of_birth: (raw.placeOfBirth ?? raw.place_of_birth ?? null) as string | null,
    blood_type: (raw.bloodType ?? raw.blood_type ?? null) as BloodType | null,
    has_authorized_pickup: (raw.hasAuthorizedPickup ?? raw.has_authorized_pickup) as boolean | undefined,
    medical_note_count: (raw.medicalNoteCount ?? raw.medical_note_count) as number | undefined,
    school_years: raw.schoolYears as { id: string; name: string }[] | undefined,
    unpaid_other_years: raw.unpaidOtherYears as { id: string; name: string; amount: string }[] | undefined,
    created_at: (raw.createdAt ?? raw.created_at) as string,
    deleted_at: (raw.deletedAt ?? raw.deleted_at ?? null) as string | null,
  };
}

export function useChild(id: string) {
  // The class shown is the one of the year being looked at.
  const { yearId, ready } = useYearScope();
  return useQuery({
    queryKey: ['children', id, yearId],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(
        `/children/${id}${yearId ? `?academic_year_id=${yearId}` : ''}`,
      );
      if (!res.success) throw apiError(res.error, 'Child not found');
      return mapChild(res.data as Record<string, unknown>);
    },
    enabled: !!id && ready,
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; first_name?: string; last_name?: string; date_of_birth?: string; gender?: string; enrollment_date?: string; national_id?: string; address?: string; place_of_birth?: string; blood_type?: BloodType }) => {
      const body: Record<string, unknown> = {};
      if (data.first_name !== undefined) body.firstName = data.first_name;
      if (data.last_name !== undefined) body.lastName = data.last_name;
      if (data.date_of_birth !== undefined) body.dateOfBirth = data.date_of_birth;
      if (data.gender !== undefined) body.gender = data.gender;
      if (data.enrollment_date !== undefined) body.enrollmentDate = data.enrollment_date;
      if (data.national_id !== undefined) body.nationalId = data.national_id;
      if (data.address !== undefined) body.address = data.address;
      if (data.place_of_birth !== undefined) body.placeOfBirth = data.place_of_birth;
      if (data.blood_type !== undefined) body.bloodType = data.blood_type;
      const res = await apiClient.put(`/children/${id}`, body);
      if (!res.success) throw apiError(res.error, 'Failed to update child');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      queryClient.invalidateQueries({ queryKey: ['children', variables.id] });
    },
  });
}

export function useDeleteChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/children/${id}`);
      if (!res.success) throw apiError(res.error, 'Failed to delete child');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
}

export function useEnrollChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, classroomId }: { childId: string; classroomId: string }) => {
      const res = await apiClient.post(`/children/${childId}/enroll`, { classroomId });
      if (!res.success) throw apiError(res.error, 'Failed to enroll child');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      queryClient.invalidateQueries({ queryKey: ['children', variables.childId] });
    },
  });
}

export function useParentLinks(childId: string) {
  return useQuery({
    queryKey: ['parent-links', childId],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>(`/children/${childId}/parent-links`);
      if (!res.success) throw apiError(res.error, 'Failed to load parent links');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!childId,
  });
}

export function useRemoveParentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, linkId }: { childId: string; linkId: string }) => {
      const res = await apiClient.delete(`/children/${childId}/parent-links/${linkId}`);
      if (!res.success) throw apiError(res.error, 'Failed to remove parent link');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['parent-links', variables.childId] });
    },
  });
}

export function useUpdateParentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, linkId, relationship, canPickup }: { childId: string; linkId: string; relationship: string; canPickup?: boolean }) => {
      const res = await apiClient.put(`/children/${childId}/parent-links/${linkId}`, { relationship, canPickup });
      if (!res.success) throw apiError(res.error, 'Failed to update parent link');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['parent-links', variables.childId] });
    },
  });
}

export function useSetPrimaryParentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, linkId }: { childId: string; linkId: string }) => {
      const res = await apiClient.patch(`/children/${childId}/parent-links/${linkId}/primary`);
      if (!res.success) throw apiError(res.error, 'Failed to set primary parent');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['parent-links', variables.childId] });
    },
  });
}

function mapEmergencyContact(c: Record<string, unknown>): EmergencyContact {
  return {
    id: c.id as string,
    name: c.name as string,
    relationship: c.relationship as string,
    phone: c.phone as string,
    address: (c.address ?? null) as string | null,
    national_id: (c.nationalId ?? c.national_id ?? null) as string | null,
    is_authorized_pickup: Boolean(c.isAuthorizedPickup),
  };
}

export function useEmergencyContacts(childId: string) {
  return useQuery({
    queryKey: ['emergency-contacts', childId],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>(`/children/${childId}/emergency-contacts`);
      if (!res.success) throw apiError(res.error, 'Failed to load emergency contacts');
      return Array.isArray(res.data) ? res.data.map(mapEmergencyContact) : [];
    },
    enabled: !!childId,
  });
}

export function useAddEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, name, relationship, phone, address, national_id, is_authorized_pickup }: {
      childId: string; name: string; relationship: string; phone: string; address?: string; national_id?: string; is_authorized_pickup: boolean;
    }) => {
      const res = await apiClient.post(`/children/${childId}/emergency-contacts`, {
        name, relationship, phone, address, nationalId: national_id, isAuthorizedPickup: is_authorized_pickup,
      });
      if (!res.success) throw apiError(res.error, 'Failed to add emergency contact');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts', variables.childId] });
    },
  });
}

export function useUpdateEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, contactId, name, relationship, phone, address, national_id, is_authorized_pickup }: {
      childId: string; contactId: string; name: string; relationship: string; phone: string; address?: string; national_id?: string; is_authorized_pickup: boolean;
    }) => {
      const res = await apiClient.put(`/children/${childId}/emergency-contacts/${contactId}`, {
        name, relationship, phone, address, nationalId: national_id, isAuthorizedPickup: is_authorized_pickup,
      });
      if (!res.success) throw apiError(res.error, 'Failed to update emergency contact');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts', variables.childId] });
    },
  });
}

export function useRemoveEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, contactId }: { childId: string; contactId: string }) => {
      const res = await apiClient.delete(`/children/${childId}/emergency-contacts/${contactId}`);
      if (!res.success) throw apiError(res.error, 'Failed to remove emergency contact');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts', variables.childId] });
    },
  });
}

export function useCreateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { first_name: string; last_name: string; date_of_birth: string; gender: string; enrollment_date: string; academic_year_id: string; national_id?: string; address?: string; place_of_birth?: string; blood_type?: BloodType }) => {
      const res = await apiClient.post('/children', {
        firstName: data.first_name,
        lastName: data.last_name,
        dateOfBirth: data.date_of_birth,
        gender: data.gender,
        enrollmentDate: data.enrollment_date,
        academicYearId: data.academic_year_id,
        nationalId: data.national_id,
        address: data.address,
        placeOfBirth: data.place_of_birth,
        bloodType: data.blood_type,
      });
      if (!res.success) {
        throw apiError(res.error, 'Failed to create child');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
}

export interface RegisterChildInput {
  child: {
    first_name: string; last_name: string; date_of_birth: string; gender: string; enrollment_date: string;
    academic_year_id: string; national_id?: string; address?: string; place_of_birth?: string; blood_type?: BloodType;
  };
  parent?:
    | { relationship: string; parentUserId: string }
    | { relationship: string; newParent: { firstName: string; lastName: string; email?: string; phone?: string } };
  emergencyContacts: Omit<EmergencyContact, 'id'>[];
  medicalNotes: { type: MedicalNoteType; title: string; details?: string | null; severity: MedicalNoteSeverity }[];
  classroomId?: string;
  billing?: { branchId: string; startDate: string; feeIds: string[] };
}

/** Saves the child and everything the wizard collected in one request: all or nothing. */
export function useRegisterChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegisterChildInput): Promise<{ childId: string; billed: boolean }> => {
      const { child } = data;
      const res = await apiClient.post<{ child: { id: string }; billing: unknown; newParentAccount: CreatedAccount | null }>('/children/register', {
        child: {
          firstName: child.first_name,
          lastName: child.last_name,
          dateOfBirth: child.date_of_birth,
          gender: child.gender,
          enrollmentDate: child.enrollment_date,
          academicYearId: child.academic_year_id,
          nationalId: child.national_id,
          address: child.address,
          placeOfBirth: child.place_of_birth,
          bloodType: child.blood_type,
        },
        parent: data.parent,
        emergencyContacts: data.emergencyContacts.map((c) => ({
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          address: c.address || undefined,
          nationalId: c.national_id || undefined,
          isAuthorizedPickup: c.is_authorized_pickup,
        })),
        medicalNotes: data.medicalNotes.map((n) => ({ ...n, details: n.details || undefined })),
        classroomId: data.classroomId,
        billing: data.billing,
      });
      if (!res.success) throw apiError(res.error, 'Failed to register child');
      const created = res.data!.newParentAccount;
      const firstName = data.parent && 'newParent' in data.parent ? data.parent.newParent.firstName : undefined;
      announceNewAccount(created && { ...created, firstName }, { role: 'parent' });
      return { childId: res.data!.child.id, billed: !!res.data!.billing };
    },
    onSuccess: () => {
      for (const key of ['children', 'users', 'classrooms', 'enrollments', 'parent-links']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

function mapMedicalNote(n: Record<string, unknown>): MedicalNote {
  return {
    id: n.id as string,
    type: n.type as MedicalNoteType,
    title: n.title as string,
    details: (n.details ?? null) as string | null,
    severity: n.severity as MedicalNoteSeverity,
    created_at: (n.createdAt ?? n.created_at) as string,
  };
}

export function useMedicalNotes(childId: string) {
  return useQuery({
    queryKey: ['medical-notes', childId],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>(`/children/${childId}/medical-notes`);
      if (!res.success) throw apiError(res.error, 'Failed to load medical notes');
      return Array.isArray(res.data) ? res.data.map(mapMedicalNote) : [];
    },
    enabled: !!childId,
  });
}

export function useAddMedicalNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, type, title, details, severity }: {
      childId: string; type: MedicalNoteType; title: string; details?: string; severity: MedicalNoteSeverity;
    }) => {
      const res = await apiClient.post(`/children/${childId}/medical-notes`, { type, title, details, severity });
      if (!res.success) throw apiError(res.error, 'Failed to add medical note');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['medical-notes', variables.childId] });
    },
  });
}

export function useUpdateMedicalNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, noteId, type, title, details, severity }: {
      childId: string; noteId: string; type: MedicalNoteType; title: string; details?: string; severity: MedicalNoteSeverity;
    }) => {
      const res = await apiClient.put(`/children/${childId}/medical-notes/${noteId}`, { type, title, details, severity });
      if (!res.success) throw apiError(res.error, 'Failed to update medical note');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['medical-notes', variables.childId] });
    },
  });
}

export function useRemoveMedicalNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, noteId }: { childId: string; noteId: string }) => {
      const res = await apiClient.delete(`/children/${childId}/medical-notes/${noteId}`);
      if (!res.success) throw apiError(res.error, 'Failed to remove medical note');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['medical-notes', variables.childId] });
    },
  });
}

export function useLinkParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, parentId, relationship, canPickup }: { childId: string; parentId: string; relationship: string; canPickup?: boolean }) => {
      const res = await apiClient.post(`/children/${childId}/parent-links`, { parentUserId: parentId, relationship, canPickup });
      if (!res.success) {
        throw apiError(res.error, 'Failed to link parent');
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      queryClient.invalidateQueries({ queryKey: ['parent-links', variables.childId] });
    },
  });
}
