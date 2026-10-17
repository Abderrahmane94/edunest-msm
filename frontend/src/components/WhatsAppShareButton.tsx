import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui';
import { whatsappLink } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

/**
 * Sends someone their access (address, sign-in, temporary password) from the
 * sender's own WhatsApp: the chat opens with the message written.
 */
export function WhatsAppShareButton({
  phone,
  name,
  login,
  password,
  className,
}: {
  phone?: string | null;
  name?: string | null;
  login: string;
  password: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const text = t('whatsapp.access', {
    name: name ? ` ${name}` : '',
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
