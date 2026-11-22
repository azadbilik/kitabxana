-- A work kept only in translation (its original not in the library: body is '') takes its
-- reading time from its default translation, then the earliest one. Kept by the database,
-- like the count itself (20261119120000_work_word_count).
CREATE OR REPLACE FUNCTION work_word_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF btrim(NEW.body) = '' THEN
    NEW."wordCount" := COALESCE((
      SELECT regexp_count(t.body, '\S*[^\s[:punct:]]\S*')
      FROM "Translation" t
      WHERE t."workId" = NEW.id
      ORDER BY t."isDefault" DESC, t."createdAt" ASC
      LIMIT 1
    ), 0);
  ELSE
    NEW."wordCount" := regexp_count(NEW.body, '\S*[^\s[:punct:]]\S*');
  END IF;
  RETURN NEW;
END;
$$;

-- A translation written, made default or removed recounts a work that has no original.
-- Rewriting body to itself fires the trigger above; the row's updatedAt (set by the
-- application) is left alone
CREATE FUNCTION translation_work_word_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Work" SET body = body
  WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD."workId" ELSE NEW."workId" END)
    AND btrim(body) = '';
  RETURN NULL;
END;
$$;

CREATE TRIGGER translation_work_word_count
  AFTER INSERT OR UPDATE OF body, "isDefault" OR DELETE ON "Translation"
  FOR EACH ROW EXECUTE FUNCTION translation_work_word_count();

UPDATE "Work" SET body = body WHERE btrim(body) = '';
