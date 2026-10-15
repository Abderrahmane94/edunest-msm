/**
 * Where the app lives, for links sent by email. FRONTEND_URL may list several
 * origins for CORS ("https://app.kiddooschool.com,https://…"): the first one.
 */
export function getFrontendUrl(): string {
  const first = (process.env.FRONTEND_URL || '').split(',')[0].trim();
  return (first || 'http://localhost:5173').replace(/\/+$/, '');
}
