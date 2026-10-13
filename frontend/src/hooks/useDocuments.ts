import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

export const DOCUMENT_CATEGORIES = ['enrollment', 'health', 'rules', 'other'] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** What the library takes, as the file picker's `accept`. */
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.odt';
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export interface SchoolDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  note: string | null;
  fileExtension: string;
  /** In bytes. */
  fileSize: number;
  visibleToParents: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentInput {
  id?: string;
  name: string;
  category: DocumentCategory;
  note: string;
  visibleToParents: boolean;
  /** Required for a new document; when given for an existing one, replaces its file. */
  file?: File | null;
}

/** The school's documents (office). */
export function useDocuments() {
  return useQuery({
    queryKey: ['documents', 'list'],
    queryFn: async () => {
      const res = await apiClient.get<SchoolDocument[]>('/documents');
      if (!res.success) throw apiError(res.error, 'Failed to load the documents');
      return res.data as SchoolDocument[];
    },
  });
}

/** What the school shows the families. */
export function useSharedDocuments() {
  return useQuery({
    queryKey: ['documents', 'shared'],
    queryFn: async () => {
      const res = await apiClient.get<SchoolDocument[]>('/documents/shared');
      if (!res.success) throw apiError(res.error, 'Failed to load the documents');
      return res.data as SchoolDocument[];
    },
  });
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || '/api';

export function useSaveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file, ...fields }: DocumentInput) => {
      const body = new FormData();
      body.append('name', fields.name);
      body.append('category', fields.category);
      body.append('note', fields.note);
      body.append('visibleToParents', String(fields.visibleToParents));
      if (file) body.append('file', file);
      const response = await fetch(`${baseUrl()}/documents${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: authHeaders(), body });
      const data = await response.json().catch(() => null);
      if (!data?.success) throw apiError(data?.error, 'Failed to save the document');
      return data.data as SchoolDocument;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/documents/${id}`);
      if (!res.success) throw apiError(res.error, 'Failed to delete the document');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

/** Reads the exact (UTF-8) file name from a Content-Disposition header. */
function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}

async function fetchFile(doc: SchoolDocument): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`${baseUrl()}/documents/${doc.id}/file`, { headers: authHeaders() });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw apiError(data?.error, 'Failed to load the file');
  }
  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get('Content-Disposition')) ?? `${doc.name}.${doc.fileExtension}`,
  };
}

/** What a browser shows itself; the rest can only be saved. */
export function opensInBrowser(doc: SchoolDocument): boolean {
  return ['pdf', 'jpg', 'png', 'webp'].includes(doc.fileExtension);
}

/** Opens a document in a new tab (PDFs, pictures: from there it is printed) or saves it. */
export function useDocumentFile() {
  const fetching = useMutation({ mutationFn: fetchFile });

  function save(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return {
    isPending: fetching.isPending,
    pendingId: fetching.isPending ? fetching.variables?.id : undefined,
    async open(doc: SchoolDocument) {
      if (!opensInBrowser(doc)) {
        const { blob, fileName } = await fetching.mutateAsync(doc);
        save(blob, fileName);
        return;
      }
      // Open the tab right away (still inside the click) so popup blockers
      // allow it, then point it at the file once loaded.
      const tab = window.open('', '_blank');
      try {
        const { blob } = await fetching.mutateAsync(doc);
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (err) {
        tab?.close();
        throw err;
      }
    },
    async download(doc: SchoolDocument) {
      const { blob, fileName } = await fetching.mutateAsync(doc);
      save(blob, fileName);
    },
  };
}

/** "245 Ko", "1,8 Mo". */
export function fileSizeLabel(bytes: number, language: string): string {
  const fr = !language.startsWith('ar');
  const number = (value: number, digits: number) => value.toLocaleString(fr ? 'fr-FR' : 'ar-DZ-u-nu-latn', { maximumFractionDigits: digits });
  if (bytes < 1024 * 1024) return `${number(Math.max(1, Math.round(bytes / 1024)), 0)} ${fr ? 'Ko' : 'ك.ب'}`;
  return `${number(bytes / (1024 * 1024), 1)} ${fr ? 'Mo' : 'م.ب'}`;
}
