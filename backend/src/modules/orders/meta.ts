import crypto from 'crypto';

/**
 * Meta Conversions API: the server's copy of the landing's events, so Meta still counts an order
 * when the browser blocks the pixel. The browser sends the same event with the same event id,
 * and Meta keeps one of the two. META_PIXEL_ID and META_CAPI_TOKEN unset: nothing is sent.
 */

const GRAPH_VERSION = 'v21.0';

export interface MetaOrder {
  id: string;
  directorName: string;
  phone: string;
  wilaya: string;
  amount: number | null;
  plan: string;
  eventId: string | null;
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  userAgent: string | null;
  pageUrl: string | null;
}

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

/** An Algerian number as Meta wants it: country code, digits only (0555 12 34 56 → 213555123456). */
export function phoneForMeta(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00213')) return digits.slice(2);
  if (digits.startsWith('213')) return digits;
  if (digits.startsWith('0')) return '213' + digits.slice(1);
  return digits;
}

/** The order's customer, hashed as Meta requires (only the browser's ids and address stay as they are). */
export function userDataOf(order: MetaOrder): Record<string, unknown> {
  const first = order.directorName.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const data: Record<string, unknown> = {
    ph: [sha256(phoneForMeta(order.phone))],
    country: [sha256('dz')],
    external_id: [sha256(order.id)],
  };
  if (first) data.fn = [sha256(first)];
  if (order.wilaya) data.st = [sha256(order.wilaya.toLowerCase())];
  if (order.fbp) data.fbp = order.fbp;
  if (order.fbc) data.fbc = order.fbc;
  if (order.ip) data.client_ip_address = order.ip;
  if (order.userAgent) data.client_user_agent = order.userAgent;
  return data;
}

/** The event Meta receives: Lead when the order is left, Purchase when the team marks it won. */
export function eventOf(name: 'Lead' | 'Purchase', order: MetaOrder, now: Date = new Date()): Record<string, unknown> {
  return {
    event_name: name,
    event_time: Math.floor(now.getTime() / 1000),
    // The Lead shares the browser's id (one of the two is kept); the Purchase happens on the platform only.
    event_id: name === 'Lead' && order.eventId ? order.eventId : `${name.toLowerCase()}-${order.id}`,
    action_source: name === 'Lead' ? 'website' : 'system_generated',
    ...(name === 'Lead' && order.pageUrl ? { event_source_url: order.pageUrl } : {}),
    user_data: userDataOf(order),
    custom_data: { currency: 'DZD', value: order.amount ?? 0, content_name: order.plan, content_type: 'product' },
  };
}

export function metaConfigured(): boolean {
  return Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN);
}

/** Sends one event; never throws (an order is saved even when Meta does not answer). */
export async function sendMetaEvent(name: 'Lead' | 'Purchase', order: MetaOrder): Promise<boolean> {
  const pixel = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return false;
  const body: Record<string, unknown> = { data: [eventOf(name, order)] };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[Kiddoo] Meta ${name} for order ${order.id}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.ok;
  } catch (error) {
    console.error(`[Kiddoo] Meta ${name} for order ${order.id} not sent:`, (error as Error).message);
    return false;
  }
}
