-- At most one default translation per work and language, enforced by the database.
-- (A partial index: Prisma's schema cannot express it, so it lives only in this migration.)

-- Where several are marked default, the oldest keeps it
UPDATE "Translation" t
SET "isDefault" = false
WHERE t."isDefault"
  AND EXISTS (
    SELECT 1 FROM "Translation" o
    WHERE o."workId" = t."workId"
      AND o."language" = t."language"
      AND o."isDefault"
      AND (o."createdAt", o."id") < (t."createdAt", t."id")
  );

CREATE UNIQUE INDEX "Translation_workId_language_default_key"
  ON "Translation" ("workId", "language")
  WHERE "isDefault";
