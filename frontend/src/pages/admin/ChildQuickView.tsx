import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Phone, ShieldCheck } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, ListSkeleton, StatusBadge } from '@/components/ui';
import { avatarColor } from '@/components/ui/Avatar';
import { ClassTag } from '@/components/ClassTag';
import { formatDate, formatDZD } from '@/lib/formatters';
import { usePermissions } from '@/lib/roles';
import { useEmergencyContacts, useMedicalNotes, useParentLinks, type MedicalNote } from '@/hooks/useChildren';
import { useChildBillingPeriods } from '@/hooks/usePayments';

/** What the quick view needs of a child (a line of the office's list, or of a teacher's class). */
export interface QuickChild {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  classroom_id?: string;
  classroom_name?: string;
  is_active?: boolean;
}

/**
 * Who looks: the office sees the parents and what is owed, and can open the
 * file; a teacher sees what serves in class (health, who to call, who may
 * pick the child up).
 */
type Scope = 'office' | 'class';

/** "8 mois", "2 ans 4 mois", "5 ans": months count while they still matter. */
export function childAge(dateOfBirth: string, t: TFunction, now: Date = new Date()): string {
  const birth = new Date(dateOfBirth);
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (Number.isNaN(months) || months < 0) return '';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return t('children.age.months', { count: rest });
  if (years >= 4 || rest === 0) return t('children.age.years', { count: years });
  return `${t('children.age.years', { count: years })} ${t('children.age.months', { count: rest })}`;
}

const SEVERITY: Record<MedicalNote['severity'], 'danger' | 'warning' | 'neutral'> = { high: 'danger', medium: 'warning', low: 'neutral' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-micro font-bold uppercase tracking-wider text-text-secondary">{title}</h3>
      {children}
    </section>
  );
}

const none = (text: string) => <p className="text-caption text-text-secondary">{text}</p>;
const call = (phone: string) => (
  <a href={`tel:${phone}`} dir="ltr" className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline tabular-nums">
    <Phone className="w-3.5 h-3.5" />
    {phone}
  </a>
);

function Body({ child, scope }: { child: QuickChild; scope: Scope }) {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const { data: notes, isLoading: notesLoading } = useMedicalNotes(child.id);
  const office = scope === 'office';
  const { data: links, isLoading: linksLoading } = useParentLinks(office ? child.id : '');
  const { data: contacts, isLoading: contactsLoading } = useEmergencyContacts(child.id);
  const seesMoney = office && (can('collections') || can('fees'));
  const { data: periods } = useChildBillingPeriods(seesMoney ? child.id : '');
  const owed = (periods ?? []).filter((p) => !p.cancelledAt).reduce((sum, p) => sum + Number(p.outstanding ?? 0), 0);
  const late = (periods ?? []).some((p) => !p.cancelledAt && p.isLate && Number(p.outstanding ?? 0) > 0);
  // The most serious first: that is what must be seen.
  const sorted = [...(notes ?? [])].sort((a, b) => ['high', 'medium', 'low'].indexOf(a.severity) - ['high', 'medium', 'low'].indexOf(b.severity));

  return (
    <div className="space-y-5">
      <Section title={t('children.medicalNotes.title')}>
        {notesLoading ? (
          <ListSkeleton rows={1} />
        ) : sorted.length === 0 ? (
          none(t('children.quick.noMedical'))
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((n) => (
              <li key={n.id} className={n.severity === 'high' ? 'rounded-lg bg-danger-muted text-danger px-3 py-2' : 'px-1'}>
                <p className="flex items-center gap-1.5 flex-wrap text-body font-medium">
                  {n.severity === 'high' && <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span className="[overflow-wrap:anywhere]">{n.title}</span>
                  <StatusBadge variant={SEVERITY[n.severity]}>{t(`children.medicalNotes.types.${n.type}`)}</StatusBadge>
                </p>
                {n.details && <p className="text-caption [overflow-wrap:anywhere]">{n.details}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {office && (
      <Section title={t('children.columns.parents')}>
        {linksLoading ? (
          <ListSkeleton rows={1} />
        ) : (links ?? []).length === 0 ? (
          none(t('children.noParents'))
        ) : (
          <ul className="space-y-1.5">
            {(links ?? []).map((link) => {
              const parent = (link.parent ?? {}) as Record<string, string | undefined>;
              return (
                <li key={link.id as string} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-body text-foreground">
                    {parent.firstName} {parent.lastName}
                    <span className="text-caption text-text-secondary"> · {link.relationship as string}</span>
                  </span>
                  {parent.phone && call(parent.phone)}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      )}

      <Section title={t('children.emergencyContacts.title')}>
        {contactsLoading ? (
          <ListSkeleton rows={1} />
        ) : (contacts ?? []).length === 0 ? (
          none(t('children.quick.noContacts'))
        ) : (
          <ul className="space-y-1.5">
            {(contacts ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-body text-foreground">
                  {c.name}
                  <span className="text-caption text-text-secondary"> · {c.relationship}</span>
                  {c.is_authorized_pickup && (
                    <span className="ms-1.5 inline-flex items-center gap-1 text-micro font-medium text-success">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t('children.quick.pickup')}
                    </span>
                  )}
                </span>
                {call(c.phone)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {seesMoney && periods && (
        <Section title={t('children.quick.owed')}>
          <p className={`text-section font-bold tabular-nums ${owed > 0 ? (late ? 'text-danger' : 'text-warning') : 'text-success'}`} dir="ltr">
            {formatDZD(owed, i18n.language)}
          </p>
          <p className="text-caption text-text-secondary">{owed === 0 ? t('children.quick.upToDate') : late ? t('children.quick.late') : t('children.quick.notLate')}</p>
        </Section>
      )}
    </div>
  );
}

/** The essentials of a child without leaving the list; the whole file is one tap away. */
export function ChildQuickView({ child, onClose, scope = 'office' }: { child: QuickChild | null; onClose: () => void; scope?: Scope }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const name = child ? `${child.first_name} ${child.last_name}` : '';
  return (
    <Dialog open={!!child} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side>
        {child && (
          <div className="space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3 pe-8">
                <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-body-lg font-semibold ${avatarColor(name)}`}>
                  {child.first_name.charAt(0)}
                  {child.last_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <DialogTitle>{name}</DialogTitle>
                  {child.date_of_birth && (
                    <DialogDescription>
                      {childAge(child.date_of_birth, t)} · <span dir="ltr">{formatDate(child.date_of_birth)}</span>
                    </DialogDescription>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {child.classroom_name ? <ClassTag id={child.classroom_id} name={child.classroom_name} /> : <StatusBadge variant="neutral">{t('children.quick.noClass')}</StatusBadge>}
                {child.is_active === false && <StatusBadge variant="neutral">{t('children.inactive')}</StatusBadge>}
              </div>
            </DialogHeader>
            <Body child={child} scope={scope} />
            {scope === 'office' ? (
              <Button type="button" className="w-full" onClick={() => navigate(`/admin/children/${child.id}`)}>
                <ExternalLink className="w-4 h-4" />
                {t('children.quick.openFile')}
              </Button>
            ) : (
              <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
                {t('common.close')}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
