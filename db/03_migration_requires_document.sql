-- =====================================================================
-- Migration 03: mandatory-document enforcement
-- Safe to run against an already-initialised database. Fresh installs
-- get this via 01_schema.sql + 02_seed.sql automatically, so you only
-- need to run this manually if your DB predates the change:
--   psql -h localhost -U aaa_user -d aaa_portal -f db/03_migration_requires_document.sql
-- =====================================================================

ALTER TABLE metrics
    ADD COLUMN IF NOT EXISTS requires_document BOOLEAN NOT NULL DEFAULT false;

-- Default policy: a metric that lists required documents in its SOP must
-- have at least one document uploaded before submission. Adjust per-metric
-- afterwards via the Admin API / UI if a specific metric should differ.
UPDATE metrics SET requires_document = true
WHERE documents_required IS NOT NULL AND btrim(documents_required) <> ''
  AND requires_document = false;
