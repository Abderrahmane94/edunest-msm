import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui';
import { accessMessage, whatsappLink } from '@/lib/whatsapp';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolBrand } from '@/hooks/useSchool';
import { cn } from '@/lib/utils';

/**
 * Sends someone their access (address, sign-in, temporary password) from the
 * sender's own WhatsApp: the chat opens with the message written.
 */
export function WhatsAppShareButton({
  kind = 'new',
  phone,
  name,
  role,
  schoolName,
  login,
  password,
  className,
}: {
  /** A new account, or a new temporary password for an existing one. */
  kind?: 'new' | 'reset';
  phone?: string | null;
  name?: string | null;
  role?: string;
  /** Defaults to the sender's own school. */
  schoolName?: string;
  login: string;
  password: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: brand } = useSchoolBrand();
  const text = accessMessage(t, {
    kind,
    name,
    role,
    school: schoolName ?? brand?.name,
    sender: user && user.role !== 'super_admin' ? `${user.firstName} ${user.lastName}` : null,
    url: window.location.origin,
    login,
    password,
  });
  return (
    <a
      href={whatsappLink(phone, text)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: 'secondary' }), 'gap-2 text-[#128C7E] hover:text-[#075E54]', className)}
    >
      <MessageCircle className="w-4 h-4" />
      {t('whatsapp.send')}
    </a>
  );
}
