-- Migration: Add normalized_handle column and uniqueness constraint
-- Purpose: Support automatic creator matching in CSV imports

-- Add normalized_handle column to social_links table
ALTER TABLE "social_links"
ADD COLUMN IF NOT EXISTS "normalized_handle" text;

-- Create function to normalize handles
CREATE OR REPLACE FUNCTION normalize_handle(handle text) RETURNS text AS $$
BEGIN
  IF handle IS NULL OR handle = '' THEN
    RETURN NULL;
  END IF;

  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          trim(handle),
          '^@+', '', 'g'        -- Remove leading @
        ),
        '/+$', '', 'g'          -- Remove trailing slashes
      ),
      '\s+', ' ', 'g'           -- Collapse multiple spaces
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Populate normalized_handle for existing records
UPDATE "social_links"
SET "normalized_handle" = normalize_handle("creator_name")
WHERE "creator_name" IS NOT NULL AND "normalized_handle" IS NULL;

-- Create index on normalized_handle for faster lookups
CREATE INDEX IF NOT EXISTS "idx_social_links_normalized_handle"
ON "social_links"("campaign_id", "normalized_handle", "platform");

-- Create partial unique index to prevent duplicate creators per campaign
-- Only applies to non-null normalized_handle values
CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_creator_per_campaign"
ON "social_links"("campaign_id", "normalized_handle", "platform")
WHERE "normalized_handle" IS NOT NULL AND "url" LIKE 'placeholder://%';

-- Add trigger to automatically populate normalized_handle on insert/update
CREATE OR REPLACE FUNCTION set_normalized_handle() RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_handle := normalize_handle(NEW.creator_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_normalized_handle ON "social_links";
CREATE TRIGGER trigger_set_normalized_handle
  BEFORE INSERT OR UPDATE OF creator_name ON "social_links"
  FOR EACH ROW
  EXECUTE FUNCTION set_normalized_handle();

-- Add comment explaining the constraint
COMMENT ON INDEX "idx_unique_creator_per_campaign" IS
'Ensures each campaign has at most one placeholder entry per unique creator (normalized_handle + platform). This prevents duplicate creators during CSV imports.';
