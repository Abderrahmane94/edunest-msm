-- What each group's client calls it and its members (association / clubs…),
-- shown on the client's screens; Kiddoo's own pages say group and nurseries.
ALTER TABLE "associations" ADD COLUMN "group_term" TEXT NOT NULL DEFAULT 'group';
ALTER TABLE "associations" ADD COLUMN "member_term" TEXT NOT NULL DEFAULT 'nursery';
