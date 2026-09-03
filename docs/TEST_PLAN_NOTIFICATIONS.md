# Test Plan — Notifications (Push / In-App / Email / SMS)

Covers the FCM web-push system plus the multi-channel notification pipeline
(`notificationService.notify` / `notifyMany` / `dispatchAbsenceNotifications`).

## Legend
- **Push** = FCM browser notification (OS-level, works when tab closed via service worker)
- **In-app** = real-time `notification:new` socket event → OS notification while tab is open
- **Email** = Resend; **SMS** = Twilio (critical types only, primary parent)

## Notification triggers in the app (source of truth)
| Trigger | Type | Channels | Recipients |
|---|---|---|---|
| Mark child absent (attendance) | `absence_alert` | push, email, SMS (primary parent) | all linked parents |
| Invoice sent | `invoice_sent` | push, email | invoice's parent |
| Payment confirmed (online) | `payment_received` | push, email | parent + admins |
| Cash payment recorded | `payment_received` | push, email | parent + recording admin |
| Overdue invoice (daily cron) | `payment_overdue` | push, email, SMS | parent |
| Announcement posted | `announcement` | push, email | targeted users / whole school |
| New message | `message_new` | push | conversation participants |

---

## A. Setup / configuration

**A1 — Backend initializes FCM when configured**
- Precondition: `FIREBASE_SERVICE_ACCOUNT` set in backend `.env`.
- Start backend. **Expect:** log `Firebase Admin initialized — push notifications enabled.`

**A2 — Backend fails soft when NOT configured**
- Remove/blank `FIREBASE_SERVICE_ACCOUNT`, restart backend.
- **Expect:** log `FIREBASE_SERVICE_ACCOUNT is not set — push notifications will be logged, not sent.` App still boots; other channels unaffected.

**A3 — Backend fails soft on malformed credential**
- Set `FIREBASE_SERVICE_ACCOUNT` to invalid JSON, restart.
- **Expect:** log `Failed to parse FIREBASE_SERVICE_ACCOUNT — push notifications disabled`; no crash.

**A4 — Frontend disabled when config missing**
- Blank the `VITE_FIREBASE_*` vars, rebuild frontend, log in.
- **Expect:** no permission prompt, no errors; `isPushConfigured()` is false; app works normally.

---

## B. Permission & token registration (frontend)

**B1 — First-time permission prompt on login**
- Fresh browser (no prior permission), log in.
- **Expect:** browser asks for notification permission once.

**B2 — Token registered on grant**
- Grant permission.
- **Expect:** `PATCH /api/users/:id/fcm-token` fires and returns success; token cached in `localStorage.fcm_token`; user row `fcmToken` populated.

**B3 — Permission denied**
- Deny the prompt.
- **Expect:** no token call, no error, app continues; no push received later.

**B4 — No duplicate registration**
- Reload the app while logged in with permission already granted.
- **Expect:** no repeat `PATCH /fcm-token` (cached token matches) unless the token rotated.

**B5 — Token cleared on logout**
- Log out.
- **Expect:** `localStorage.fcm_token` removed. Next user logging in registers their own token.

**B6 — Prompt not shown before authentication**
- Visit the login page while logged out.
- **Expect:** no permission prompt (only fires for authenticated users).

---

## C. Absence alerts (highest value path)

**C2 — Absent marking sends to all linked parents**
- Child with 2 linked parents; mark child absent for a date.
- **Expect:** each parent gets a persisted notification (`absence_alert`), a push (if token), and an email. Primary parent also gets SMS (if phone on file).

**C3 — Localized content (Arabic vs French)**
- Parent A `preferredLanguage=ar`, Parent B `fr`; mark their child absent.
- **Expect:** Parent A gets Arabic title/body (تنبيه غياب…), Parent B gets French (Alerte d'absence…).

**C4 — Child with no linked parents**
- Mark an unlinked child absent.
- **Expect:** no notifications created; log notes skip; no error.

**C5 — Primary parent without phone**
- Primary parent has no `phone`.
- **Expect:** push + email sent; SMS skipped with a logged warning; other parents unaffected.

**C6 — Present/late marking does NOT notify**
- Mark child present or late.
- **Expect:** no absence notification dispatched.

---

## D. Finance notifications

**D1 — Invoice sent** → parent receives `invoice_sent` push + email; body includes the payment link/context.

**D2 — Online payment confirmed** → parent receives `payment_received`; all school admins also receive a `payment_received` notification.

**D3 — Cash payment recorded** → parent receives `payment_received`; the recording admin receives an internal confirmation.

**D4 — Overdue invoice cron** → run/simulate the daily job; parent of each overdue invoice gets `payment_overdue` push + email, and SMS (critical type).

**D5 — Partial cash payment** → confirmation reflects correct remaining balance (0 when fully paid).

---

## E. Announcements & messages

**E1 — Announcement to whole school** → all active users except the author receive `announcement` push + email.

**E2 — Targeted announcement** → only targeted users receive it; non-targeted users do not.

**E3 — Long announcement body truncated** → push body is truncated to ~200 chars with an ellipsis.

**E4 — New message** → conversation participants receive a `message_new` push; sender does not notify themselves.

---

## F. Delivery behavior & resilience

**F1 — Background delivery (tab closed)**
- Close/background the tab, trigger a push.
- **Expect:** OS notification appears via the service worker; clicking it focuses/opens the app.

**F2 — Foreground delivery (tab open)**
- Keep the app focused, trigger a push.
- **Expect:** an OS notification shows once (foreground handler), not duplicated.

**F3 — In-app real-time (socket) while open**
- With the app open, trigger any `notify`.
- **Expect:** `notification:new` socket event received; notification surfaced without a page refresh.

**F4 — Stale/invalid token pruned**
- Register a token, then invalidate it (revoke permission / uninstall / use a bogus token), then trigger a notification.
- **Expect:** FCM reports the token invalid; backend clears that user's `fcmToken`; no repeated failures on the next send.

**F5 — Notification always persisted regardless of delivery**
- Trigger a notification for a user with NO `fcmToken`.
- **Expect:** the `Notification` DB row is still created; push is skipped; in-app inbox still shows it.

**F6 — One channel failing doesn't block others**
- Simulate email service failure.
- **Expect:** push still delivered; failures are logged, not thrown (fire-and-forget `allSettled`).

**F7 — Unread count & mark-as-read**
- Receive several notifications; open the in-app inbox.
- **Expect:** unread count correct; mark-one and mark-all update state and persist.

---

## G. Cross-cutting

**G1 — HTTPS requirement** — on a non-localhost HTTP origin, service worker/push registration fails gracefully (expected browser limitation).

**G2 — iOS Safari (plain tab)** — push not offered/received in a normal iOS Safari tab; only works as an installed PWA (Home Screen, iOS 16.4+). Document as known limitation.

**G3 — Multi-device** — same user logged in on two browsers registers a token per device. (Current model stores a single `fcmToken` per user — the latest device wins. Note this as a known limitation if multi-device push is required.)

**G4 — RTL rendering** — Arabic notifications render correctly in the in-app inbox with RTL layout.
