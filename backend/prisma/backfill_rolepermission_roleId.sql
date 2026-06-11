-- PHASE D1: backfill RolePermission.roleId FK
-- Run AFTER `prisma db push` has added the nullable roleId column to RolePermission.
-- This links every RolePermission row to its Role via roleId, matching the existing role string.

UPDATE rp
SET rp.roleId = r.id
FROM [RolePermission] rp
INNER JOIN [Role] r ON r.[name] = rp.[role]
WHERE rp.roleId IS NULL;
