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

export function whatsappLink(phone: string | null | undefined, text: string): string {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`;
}
