-- Words in a work's text, for its reading time. Kept by the database, not the application:
-- the API, the parser's importers and hand-run SQL all write "Work".body, and each of them
-- gets the count without knowing about it. (The trigger lives only in this migration.)
-- A word is a run of non-space characters with at least one that is not ASCII punctuation,
-- so Markdown's #, >, *, --- and lone dashes are not counted; Arabic script counts.
ALTER TABLE "Work" ADD COLUMN "wordCount" INTEGER NOT NULL DEFAULT 0;

CREATE FUNCTION work_word_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."wordCount" := regexp_count(NEW.body, '\S*[^\s[:punct:]]\S*');
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_word_count
  BEFORE INSERT OR UPDATE OF body ON "Work"
  FOR EACH ROW EXECUTE FUNCTION work_word_count();

-- Leaves updatedAt alone: counting words is not an edit
UPDATE "Work" SET "wordCount" = regexp_count(body, '\S*[^\s[:punct:]]\S*');
