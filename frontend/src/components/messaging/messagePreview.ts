import type { TFunction } from 'i18next';

/**
 * A conversation's last message as shown in the list: the server sends
 * "[photo]" / "[document]" for a file, shown here in the user's language.
 */
export function messagePreview(text: string, t: TFunction): string {
  if (text === '[photo]') return `📷 ${t('messages.sendPhoto')}`;
  if (text === '[document]') return `📎 ${t('messages.sendDocument')}`;
  return text;
}
