-- The sessions already open stay open: each refresh token is replaced by its
-- SHA-256 hash (hex), which is what the server now stores and looks up.
UPDATE "refresh_tokens" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
