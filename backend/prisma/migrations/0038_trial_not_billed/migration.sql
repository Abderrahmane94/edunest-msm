-- A free trial isn't billed: the first billed period starts when the trial
-- ends. Subscriptions assigned with a trial before this fix had their first
-- period start on the trial's first day; move it after the trial for those
-- not paid yet (a payment already recorded is left as it is).
UPDATE "school_subscriptions" s
SET "current_period_start" = s."trial_ends_at",
    "current_period_end" = (s."trial_ends_at" + CASE WHEN s."billing_cycle" = 'annual'
                                                     THEN INTERVAL '1 year'
                                                     ELSE INTERVAL '1 month' END)::date
WHERE s."trial_ends_at" IS NOT NULL
  AND s."current_period_start" < s."trial_ends_at"
  AND NOT EXISTS (
    SELECT 1 FROM "subscription_payments" p
    WHERE p."subscription_id" = s."id" AND p."deleted_at" IS NULL
  );
