-- Backfill roleId for ALL existing User rows.
-- Matches each user's legacy `role` string to the normalised Role table,
-- then writes the corresponding Role.id into User.roleId.
-- Run this in SSMS AFTER `prisma db push` has created the Role table
-- and its seed rows (ADMIN, MANAGER, STAFF, DRIVER).
--
-- Safe to re-run: the WHERE clause prevents overwriting rows that already
-- have a roleId (future-proofs against manual backfill or later inserts).

UPDATE u
SET    u.roleId = r.id
FROM   [User] u
INNER  JOIN [Role] r ON r.[name] = u.[role]
WHERE  u.roleId IS NULL;
