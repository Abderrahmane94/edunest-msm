import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Phone, StickyNote } from 'lucide-react';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  FilterChips,
  ListSkeleton,
  PageHeader,
  StatusBadge,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { apiClient, apiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/errorMessage';
import { formatDateTime, formatDZD } from '@/lib/formatters';
import { whatsappLink } from '@/lib/whatsapp';

type OrderStatus = 'new' | 'contacted' | 'won' | 'lost';
const STATUSES: OrderStatus[] = ['new', 'contacted', 'won', 'lost'];
const BADGE: Record<OrderStatus, 'info' | 'warning' | 'success' | 'neutral'> = { new: 'info', contacted: 'warning', won: 'success', lost: 'neutral' };

interface OrderRow {
  id: string;
  reference: string;
  status: OrderStatus;
  plan: 'small' | 'standard' | 'network';
  cycle: 'monthly' | 'annual';
  amount: number | null;
  directorName: string;
  nurseryName: string | null;
  phone: string;
  wilaya: string;
  childrenCount: number | null;
  language: 'fr' | 'ar';
  note: string | null;
  source: string | null;
  utm: Record<string, string> | null;
  createdAt: string;
}

interface OrdersData {
  orders: OrderRow[];
  counts: Partial<Record<OrderStatus, number>>;
}

/** The 58 wilayas, by their code. */
const WILAYAS = ['Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem', "M'Sila", 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arreridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', "El M'Ghair", 'El Meniaa'];
const wilayaName = (code: string) => `${code} · ${WILAYAS[Number(code) - 1] ?? ''}`;

function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    staleTime: 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await apiClient.get<OrdersData>('/orders');
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to load the orders');
      return res.data;
    },
  });
}

function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; status?: OrderStatus; note?: string | null }) => {
      const res = await apiClient.patch(`/orders/${id}`, body);
      if (!res.success) throw apiError(res.error, 'Failed to update the order');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

/** The landing pages' orders: the platform calls each director back and follows the order to its end. */
export function OrdersPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useOrders();
  const update = useUpdateOrder();
  const [filter, setFilter] = React.useState<OrderStatus | 'all'>('all');
  const [noteOf, setNoteOf] = React.useState<OrderRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const counts = data?.counts ?? {};
  const all = data?.orders ?? [];
  const rows = filter === 'all' ? all : all.filter((o) => o.status === filter);
  const setStatus = (row: OrderRow, status: OrderStatus) =>
    update.mutate({ id: row.id, status }, { onError: (err) => setError(errorMessage(err, t)) });

  const columns: Column<OrderRow>[] = [
    {
      key: 'directorName',
      header: t('orders.columns.director'),
      render: (row) => (
        <span className="block">
          <span className="block text-body font-medium text-foreground" dir="auto">{row.directorName}</span>
          <span className="block text-caption text-text-secondary" dir="auto">
            {[row.nurseryName, wilayaName(row.wilaya)].filter(Boolean).join(' · ')}
          </span>
          {row.note && <span className="block text-caption text-text-secondary italic mt-0.5" dir="auto">{row.note}</span>}
        </span>
      ),
    },
    {
      key: 'plan',
      header: t('orders.columns.plan'),
      render: (row) => (
        <span className="block">
          <span className="block text-body text-foreground">{t(`orders.plans.${row.plan}`)}</span>
          <span className="block text-caption text-text-secondary">
            {row.amount == null ? t('orders.quote') : `${formatDZD(row.amount, i18n.language)} · ${t(`orders.cycles.${row.cycle}`)}`}
          </span>
        </span>
      ),
    },
    {
      key: 'phone',
      header: t('orders.columns.phone'),
      render: (row) => (
        <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 text-body text-primary hover:underline" dir="ltr">
          <Phone className="w-3.5 h-3.5" />
          {row.phone}
        </a>
      ),
    },
    {
      key: 'createdAt',
      header: t('orders.columns.received'),
      render: (row) => (
        <span className="block">
          <span className="block text-caption text-text-secondary">{`⁨${formatDateTime(row.createdAt)}⁩`}</span>
          <span className="block text-caption text-text-disabled" dir="ltr">
            {row.reference}
            {row.utm?.utm_source ? ` · ${row.utm.utm_source}` : row.source ? ` · ${row.source}` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t('orders.columns.status'),
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <StatusBadge variant={BADGE[row.status]}>{t(`orders.status.${row.status}`)}</StatusBadge>
          <select
            aria-label={t('orders.changeStatus', { ref: row.reference })}
            className="rounded-md border border-border bg-surface px-2 py-1 text-caption text-foreground"
            value={row.status}
            disabled={update.isPending}
            onChange={(e) => setStatus(row, e.target.value as OrderStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t(`orders.status.${s}`)}</option>
            ))}
          </select>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <a
            href={whatsappLink(row.phone, t('orders.whatsapp', { lng: row.language, name: row.directorName, ref: row.reference }))}
            target="_blank"
            rel="noreferrer"
            title={t('orders.write')}
            onClick={() => row.status === 'new' && setStatus(row, 'contacted')}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-body text-[#128C7E] hover:bg-subtle focus-visible:outline-none focus-visible:shadow-focus-ring"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="max-sm:hidden">{t('orders.write')}</span>
          </a>
          <Button variant="ghost" size="sm" title={t('orders.note')} onClick={() => setNoteOf(row)}>
            <StickyNote className="w-4 h-4 text-primary" />
            <span className="max-sm:hidden">{t('orders.note')}</span>
          </Button>
        </div>
      ),
    },
  ];

  const total = STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('orders.title')} description={t('orders.description')} />
      <ErrorAlert message={error} onDismiss={() => setError(null)} />
      <FilterChips<OrderStatus | 'all'>
        label={t('orders.filter')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('orders.all'), count: total },
          ...STATUSES.map((s) => ({ value: s, label: t(`orders.status.${s}`), count: counts[s] ?? 0 })),
        ]}
      />
      {isLoading ? (
        <ListSkeleton />
      ) : (
        <DataTable<OrderRow> columns={columns} data={rows} keyExtractor={(row) => row.id} emptyMessage={t('orders.empty')} />
      )}
      <NoteDialog order={noteOf} onClose={() => setNoteOf(null)} />
    </div>
  );
}

function NoteDialog({ order, onClose }: { order: OrderRow | null; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateOrder();
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setNote(order?.note ?? '');
    setError(null);
  }, [order]);

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('orders.noteTitle', { ref: order?.reference ?? '' })}</DialogTitle>
          <DialogDescription>{order?.directorName}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!order) return;
            update.mutate({ id: order.id, note: note.trim() || null }, { onSuccess: onClose, onError: (err) => setError(errorMessage(err, t)) });
          }}
          className="space-y-3"
        >
          <textarea
            className="w-full min-h-[120px] rounded-lg border border-border bg-surface px-3 py-2 text-body text-foreground focus-visible:outline-none focus-visible:shadow-focus-ring"
            value={note}
            maxLength={2000}
            dir="auto"
            placeholder={t('orders.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
            aria-label={t('orders.note')}
          />
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={update.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
