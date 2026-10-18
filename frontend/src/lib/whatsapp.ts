import type { TFunction } from 'i18next';

/**
 * A WhatsApp link that opens a chat with this number, the message already
 * written: the sender only presses "send". Free, and sent from their own
 * WhatsApp (no WhatsApp Business account). Without a number WhatsApp lets
 * them pick the contact.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // An Algerian number written the local way: 0 then 9 digits.
  else if (digits.startsWith('0') && digits.length === 10) digits = `213${digits.slice(1)}`;
  return digits.length >= 8 ? digits : null;
}

const INTRO_ROLES = ['parent', 'teacher', 'admin', 'administrative'];

/**
 * The message that gives someone their access: who writes, what Kiddoo is
 * for them, then the three things to type. *…* is bold in WhatsApp.
 */
export function accessMessage(
  t: TFunction,
  a: {
    kind: 'new' | 'reset';
    name?: string | null;
    role?: string;
    school?: string | null;
    /** Who signs it; none: the Kiddoo team (a super admin). */
    sender?: string | null;
    url: string;
    login: string;
    password: string;
  },
): string {
  const intro =
    a.kind === 'reset'
      ? t('whatsapp.msg.reset')
      : a.school && a.role && INTRO_ROLES.includes(a.role)
        ? t(`whatsapp.msg.intro.${a.role}`, { school: a.school })
        : t('whatsapp.msg.intro.other');
  const blocks = [
    a.name ? t('whatsapp.msg.greeting', { name: a.name }) : t('whatsapp.msg.greetingNoName'),
    intro,
    [
      t('whatsapp.msg.link', { url: `${a.url}/login` }),
      t('whatsapp.msg.login', { login: a.login }),
      t('whatsapp.msg.password', { password: a.password }),
    ].join('\n'),
    t('whatsapp.msg.firstLogin'),
    ...(a.kind === 'new' ? [t('whatsapp.msg.homeScreen')] : []),
    [t('whatsapp.msg.private'), t('whatsapp.msg.reply')].join('\n'),
    `— ${a.sender || t('whatsapp.msg.team')}`,
  ];
  return blocks.join('\n\n');
}

export function whatsappLink(phone: string | null | undefined, text: string): string {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`;
}
