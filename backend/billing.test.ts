/**
 * Billing module integration tests — runs against the live dev server on :3000
 * Usage: npx ts-node --skip-project billing.test.ts
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3000/api';
const SECRET = process.env.JWT_ACCESS_SECRET!;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(role = 'super_admin', schoolId: string | null = null) {
  return jwt.sign({ userId: 'test-super-admin', schoolId, role }, SECRET, { expiresIn: '1h' });
}

async function req(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as any;
  return { status: res.status, ...json };
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

async function run() {
  const SA = makeToken('super_admin', null);
  const ADMIN = makeToken('admin', 'some-school-id');

  console.log('\n══════════════════════════════════════════');
  console.log('  BILLING MODULE — Integration Tests');
  console.log('══════════════════════════════════════════\n');

  // ── 1. RBAC ──────────────────────────────────────────────────────────────
  console.log('▶  1. Access Control');
  {
    const r = await req('GET', '/billing/plans', undefined, ADMIN);
    assert('Non-super_admin blocked from billing', r.status === 403);

    const r2 = await req('GET', '/billing/plans');
    assert('Unauthenticated blocked from billing', r2.status === 401);
  }

  // ── 2. Plans — validation ────────────────────────────────────────────────
  console.log('\n▶  2. Plan Validation');
  {
    const r = await req('POST', '/billing/plans', {}, SA);
    assert('Create plan: empty body rejected (400)', r.status === 400);

    const r2 = await req('POST', '/billing/plans', { name: 'X', priceMonthly: -1 }, SA);
    assert('Create plan: negative price rejected', r2.status === 400);

    const r3 = await req('POST', '/billing/plans', { name: '', priceMonthly: 1000 }, SA);
    assert('Create plan: empty name rejected', r3.status === 400);
  }

  // ── 3. Plans — CRUD ──────────────────────────────────────────────────────
  console.log('\n▶  3. Plans CRUD');
  let planId = '';
  {
    const r = await req('POST', '/billing/plans', {
      name: 'Test Plan',
      priceMonthly: 2000,
      priceAnnual: 20000,
      maxChildren: 50,
      maxUsers: 10,
    }, SA);
    assert('Create plan succeeds', r.success === true && r.status === 201);
    planId = r.data?.id;
    assert('Plan has correct monthly price', r.data?.priceMonthly === 2000);
    assert('Plan has annual price', r.data?.priceAnnual === 20000);

    const list = await req('GET', '/billing/plans', undefined, SA);
    assert('List plans returns array', Array.isArray(list.data));
    const found = list.data?.find((p: any) => p.id === planId);
    assert('Created plan appears in list', !!found);

    const upd = await req('PUT', `/billing/plans/${planId}`, { priceMonthly: 2500 }, SA);
    assert('Update plan succeeds', upd.success === true);
    assert('Updated price reflected', upd.data?.priceMonthly === 2500);

    const badId = await req('PUT', '/billing/plans/00000000-0000-0000-0000-000000000000', { priceMonthly: 1 }, SA);
    assert('Update non-existent plan returns 404', badId.status === 404);
  }

  // ── 4. Get a real school for subscription tests ───────────────────────────
  console.log('\n▶  4. Fetch a real school');
  let schoolId = '';
  {
    const schools = await req('GET', '/schools', undefined, SA);
    const list = Array.isArray(schools.data) ? schools.data : schools.data?.schools;
    assert('Schools list returned', Array.isArray(list) && list.length > 0, JSON.stringify(list?.slice(0,1)));
    schoolId = list?.[0]?.id ?? '';
    assert('Got a school ID', !!schoolId);
  }

  // ── 5. Assign plan ────────────────────────────────────────────────────────
  console.log('\n▶  5. Assign Plan');
  let subId = '';
  {
    // Validation
    const v1 = await req('POST', '/billing/subscriptions', { schoolId, planId }, SA);
    assert('Assign: missing billingCycle rejected', v1.status === 400);

    const v2 = await req('POST', '/billing/subscriptions', {
      schoolId: 'not-a-uuid', planId, billingCycle: 'monthly', startDate: '2026-01-01',
    }, SA);
    assert('Assign: invalid UUID rejected', v2.status === 400);

    // Valid assignment
    const r = await req('POST', '/billing/subscriptions', {
      schoolId, planId, billingCycle: 'monthly', startDate: '2027-01-01',
    }, SA);
    assert('Assign plan succeeds', r.success === true, JSON.stringify(r.error));
    subId = r.data?.id;
    assert('Status is overdue (no trial, no payment)', r.data?.status === 'overdue');

    // Duplicate active block
    // First need to make it active by recording a payment
    const pay = await req('POST', `/billing/subscriptions/${subId}/payments`, {
      amount: 2500,
      periodStart: '2027-01-01',
      periodEnd: '2027-02-01',
      paidAt: '2027-01-01',
    }, SA);
    assert('Payment recorded → status active', pay.success === true, JSON.stringify(pay.error));

    const sub = await req('GET', '/billing/subscriptions', undefined, SA);
    const activeSub = sub.data?.find((s: any) => s.id === subId);
    assert('Subscription is now active', activeSub?.status === 'active');

    // Try to re-assign while active
    const dup = await req('POST', '/billing/subscriptions', {
      schoolId, planId, billingCycle: 'monthly', startDate: '2027-02-01',
    }, SA);
    assert('Re-assign while active period → 409', dup.status === 409, JSON.stringify(dup.error));
  }

  // ── 6. Payment validation ─────────────────────────────────────────────────
  console.log('\n▶  6. Payment Validation');
  {
    const v1 = await req('POST', `/billing/subscriptions/${subId}/payments`, {
      amount: -100, periodStart: '2027-02-01', periodEnd: '2027-03-01', paidAt: '2027-02-01',
    }, SA);
    assert('Negative amount rejected', v1.status === 400);

    const v2 = await req('POST', `/billing/subscriptions/${subId}/payments`, {
      amount: 2500, periodStart: '2027-03-01', periodEnd: '2027-02-01', paidAt: '2027-02-01',
    }, SA);
    assert('Period end before start rejected', v2.status === 400);

    const v3 = await req('POST', `/billing/subscriptions/${subId}/payments`, {
      amount: 2500, periodStart: 'not-a-date', periodEnd: '2027-03-01', paidAt: '2027-02-01',
    }, SA);
    assert('Invalid date format rejected', v3.status === 400);
  }

  // ── 7. Status transitions ─────────────────────────────────────────────────
  console.log('\n▶  7. Status Transitions');
  {
    // Invalid status value
    const v = await req('PATCH', `/billing/subscriptions/${subId}/status`, { status: 'hacked' }, SA);
    assert('Invalid status value rejected', v.status === 400);

    // Suspend active sub
    const s1 = await req('PATCH', `/billing/subscriptions/${subId}/status`, { status: 'suspended' }, SA);
    assert('Suspend succeeds', s1.success === true);
    assert('Status is suspended', s1.data?.status === 'suspended');

    // Payment blocked on suspended
    const p = await req('POST', `/billing/subscriptions/${subId}/payments`, {
      amount: 2500, periodStart: '2027-02-01', periodEnd: '2027-03-01', paidAt: '2027-02-01',
    }, SA);
    assert('Payment on suspended sub blocked', p.status === 400);

    // Reactivate
    const s2 = await req('PATCH', `/billing/subscriptions/${subId}/status`, { status: 'active' }, SA);
    assert('Reactivate suspended → active', s2.success === true);

    // Cancel
    const s3 = await req('PATCH', `/billing/subscriptions/${subId}/status`, { status: 'cancelled' }, SA);
    assert('Cancel succeeds', s3.success === true && s3.data?.status === 'cancelled');
    assert('cancelledAt is set', !!s3.data?.cancelledAt);

    // Payment blocked on cancelled
    const p2 = await req('POST', `/billing/subscriptions/${subId}/payments`, {
      amount: 2500, periodStart: '2027-02-01', periodEnd: '2027-03-01', paidAt: '2027-02-01',
    }, SA);
    assert('Payment on cancelled sub blocked', p2.status === 400);
  }

  // ── 8. Trial assignment ───────────────────────────────────────────────────
  console.log('\n▶  8. Trial Subscription');
  let trialSubId = '';
  {
    // Cancel the existing sub first so we can re-assign
    // (already cancelled above)

    // Assign with trial (cancelled sub can be overwritten)
    const r = await req('POST', '/billing/subscriptions', {
      schoolId, planId, billingCycle: 'annual', startDate: '2027-06-01', trialDays: 30,
    }, SA);
    assert('Assign with trial succeeds', r.success === true, JSON.stringify(r.error));
    trialSubId = r.data?.id;
    assert('Status is trial', r.data?.status === 'trial');
    assert('trialEndsAt is set', !!r.data?.trialEndsAt);
    assert('billingCycle is annual', r.data?.billingCycle === 'annual');
  }

  // ── 9. Stats ─────────────────────────────────────────────────────────────
  console.log('\n▶  9. Stats');
  {
    const r = await req('GET', '/billing/stats', undefined, SA);
    assert('Stats endpoint succeeds', r.success === true);
    assert('Stats has mrr', typeof r.data?.mrr === 'number');
    assert('Stats has revenueThisMonth', typeof r.data?.revenueThisMonth === 'number');
    assert('Stats has totalRevenue', typeof r.data?.totalRevenue === 'number');
    assert('Stats has active count', typeof r.data?.active === 'number');
    assert('Stats has trial count', typeof r.data?.trial === 'number');
    // Trial sub should not inflate MRR (it is trial, not active)
    // We cancelled the active one above, so MRR from our test plan should be 0
    console.log(`     MRR reported: ${r.data?.mrr} — trial=${r.data?.trial} active=${r.data?.active}`);
  }

  // ── 10. School payments filter ────────────────────────────────────────────
  console.log('\n▶  10. Payments Query');
  {
    const missing = await req('GET', '/billing/payments', undefined, SA);
    assert('Payment query without schoolId → 400', missing.status === 400);

    const r = await req('GET', `/billing/payments?schoolId=${schoolId}`, undefined, SA);
    assert('Payments by school succeeds', r.success === true);
    assert('Returns array', Array.isArray(r.data));
    if (r.data?.length > 0) {
      assert('Payment has amount field', typeof r.data[0].amount === 'number');
      assert('Payment has subscription field', !!r.data[0].subscription);
    }

    // Date filter
    const filtered = await req('GET', `/billing/payments?schoolId=${schoolId}&from=2026-01-01&to=2026-01-31`, undefined, SA);
    assert('Date-filtered payments succeed', filtered.success === true);
  }

  // ── 11. Delete plan ───────────────────────────────────────────────────────
  console.log('\n▶  11. Delete Plan');
  {
    // Create a fresh plan with no subscriptions
    const p = await req('POST', '/billing/plans', { name: 'Deletable Plan', priceMonthly: 500 }, SA);
    const pid = p.data?.id;

    const del = await req('DELETE', `/billing/plans/${pid}`, undefined, SA);
    assert('Delete plan with no subs succeeds', del.success === true);

    // Cannot delete plan with subscriptions (trialSubId uses planId)
    const del2 = await req('DELETE', `/billing/plans/${planId}`, undefined, SA);
    assert('Delete plan with existing subs → 400', del2.status === 400);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
