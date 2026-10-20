import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Trash2, Upload } from 'lucide-react';
import {
  Avatar,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  useConfirm,
} from '@/components/ui';
import { useRemoveChildPhoto, useUploadChildPhoto } from '@/hooks/useChildPhoto';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate } from '@/lib/formatters';
import { squarePhoto } from '@/lib/squarePhoto';
import { cn } from '@/lib/utils';

interface ChildPhotoEditorProps {
  childId: string;
  /** The child's full name. */
  name: string;
  photoUrl?: string | null;
  photoConsentAt?: string | null;
  photoConsentByName?: string | null;
  /** A parent agrees for their own child; the office records that the parents agreed. */
  mode: 'parent' | 'office';
  /** The large round photo of a page header, or a row in a list. */
  layout?: 'header' | 'row';
  className?: string;
}

/**
 * A child's photo, and how to add, change or remove it. Before it is sent, the
 * photo is cut to a square and made small on the device, and the parents'
 * agreement is asked (ticked by the parent, or confirmed by the office).
 */
export function ChildPhotoEditor({
  childId,
  name,
  photoUrl,
  photoConsentAt,
  photoConsentByName,
  mode,
  layout = 'row',
  className,
}: ChildPhotoEditorProps) {
  const { t } = useTranslation();
  const upload = useUploadChildPhoto(childId);
  const remove = useRemoveChildPhoto(childId);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<{ blob: Blob; url: string } | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;

  // The preview's link is released once it is no longer shown.
  React.useEffect(() => () => {
    if (pending) URL.revokeObjectURL(pending.url);
  }, [pending]);

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem(null);
    try {
      const blob = await squarePhoto(file);
      setConsent(false);
      setPending({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setProblem(t('childPhoto.unreadable'));
    }
  }

  async function save() {
    if (!pending || !consent) return;
    try {
      await upload.mutateAsync(pending.blob);
      setPending(null);
    } catch (err) {
      setProblem(errorMessage(err, t));
      setPending(null);
    }
  }

  async function removePhoto() {
    if (!(await confirm({ title: t('childPhoto.removeTitle', { name }), description: t('childPhoto.removeText'), confirmLabel: t('childPhoto.remove') }))) return;
    setProblem(null);
    try {
      await remove.mutateAsync();
    } catch (err) {
      setProblem(errorMessage(err, t));
    }
  }

  const big = layout === 'header';
  const consentLine = photoConsentAt
    ? t('childPhoto.consentBy', { name: `⁨${photoConsentByName ?? '—'}⁩`, date: `⁨${formatDate(photoConsentAt)}⁩` })
    : '';
  return (
    <div className={cn('flex items-center gap-3 min-w-0', className)}>
      {confirmDialog}
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        className="relative shrink-0 rounded-full group focus-visible:outline-none focus-visible:shadow-focus-ring"
        aria-label={t(photoUrl ? 'childPhoto.change' : 'childPhoto.add')}
        // The large header has no room for it: who agreed, on hovering.
        title={big && photoUrl && photoConsentAt ? consentLine : undefined}
      >
        <Avatar
          src={photoUrl}
          name={name}
          size="lg"
          className={cn(big ? '!w-20 !h-20 !text-section ring-4 ring-white shadow-level-2' : '')}
        />
        <span className="absolute -bottom-0.5 -end-0.5 w-7 h-7 rounded-full bg-primary text-[var(--color-text-inverse)] flex items-center justify-center ring-2 ring-white">
          <Camera className="w-3.5 h-3.5" />
        </span>
      </button>
      {!big && (
        <div className="min-w-0 space-y-1">
          <p className="text-body font-medium text-foreground truncate">{name}</p>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
              <Upload className="w-4 h-4" />
              {t(photoUrl ? 'childPhoto.change' : 'childPhoto.add')}
            </Button>
            {photoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={removePhoto} disabled={busy}>
                <Trash2 className="w-4 h-4" />
                {t('childPhoto.remove')}
              </Button>
            )}
          </div>
          {photoUrl && photoConsentAt && (
            <p className="text-caption text-text-secondary">
              {consentLine}
            </p>
          )}
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={choose}
        className="hidden"
        aria-hidden="true"
        data-testid={`child-photo-input-${childId}`}
      />
      {big && photoUrl && (
        <Button type="button" variant="ghost" size="sm" onClick={removePhoto} disabled={busy} className="self-end" aria-label={t('childPhoto.remove')} title={t('childPhoto.remove')}>
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
      {problem && <ErrorAlert message={problem} onDismiss={() => setProblem(null)} className="w-full" />}

      <Dialog open={!!pending} onOpenChange={(open) => { if (!open && !upload.isPending) setPending(null); }}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('childPhoto.dialogTitle', { name })}</DialogTitle>
            <DialogDescription>{t('childPhoto.hint')}</DialogDescription>
          </DialogHeader>
          {pending && <img src={pending.url} alt={name} className="mx-auto w-40 h-40 rounded-full object-cover shadow-level-2" />}
          <label className="mt-4 flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
            <input
              type="checkbox"
              name="photo-consent"
              className="mt-0.5 w-4 h-4 shrink-0 rounded border-border text-primary"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="text-body text-foreground">
              {mode === 'parent' ? t('childPhoto.consentParent') : t('childPhoto.consentOffice', { name })}
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPending(null)} disabled={upload.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={save} disabled={!consent || upload.isPending}>
              {upload.isPending ? t('childPhoto.saving') : t('childPhoto.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
