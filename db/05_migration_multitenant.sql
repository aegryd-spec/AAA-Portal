-- =====================================================================
-- Migration 05: Multi-tenant Campus -> Department hierarchy + director roles
--
-- Model: a CAMPUS is a tenant. A row in the existing `schools` table now
-- represents a DEPARTMENT that belongs to a campus (the operating unit that
-- owns audit submissions). Submissions/evidence/tasks keep keying off
-- school_id (= department id), so the proven engine is reused unchanged;
-- campuses add the tenant layer above.
--
-- Safe to run against an already-initialised database (idempotent). Fresh
-- Docker installs run it automatically after 01-04.
--   psql -h localhost -U aaa_user -d aaa_portal -f db/05_migration_multitenant.sql
-- =====================================================================

-- ---------- New roles ----------
INSERT INTO roles (code, label, description) VALUES
 ('campus_director',        'Campus Director',
   'Tenant admin for one campus: manages its departments, assigns department directors and coordinators, campus-wide dashboard'),
 ('department_director',    'Department Director',
   'Director over one or more departments; assigns the responsible faculty/coordinator, department-wise dashboard'),
 ('department_coordinator', 'Department Coordinator',
   'Responsible faculty/coordinator who owns a department''s audit submissions')
ON CONFLICT (code) DO NOTHING;

-- Update the old 'iqac' label to make its university-wide scope explicit.
UPDATE roles SET label = 'University IQAC Coordinator',
       description = 'University-wide quality cell: runs DVV validation, oversees every campus and department, final approval before Peer Team'
WHERE code = 'iqac';

-- ---------- Campuses (tenants) ----------
CREATE TABLE IF NOT EXISTS campuses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    location    VARCHAR(255),
    director_id UUID REFERENCES users(id),   -- campus director (tenant admin)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A `schools` row = a DEPARTMENT. Attach it to a campus and (optionally) a director.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS campus_id   UUID REFERENCES campuses(id) ON DELETE CASCADE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS director_id UUID REFERENCES users(id);  -- department director

-- Users: campus membership (for campus-level roles). Department membership = school_id.
ALTER TABLE users ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schools_campus ON schools(campus_id);
CREATE INDEX IF NOT EXISTS idx_users_campus   ON users(campus_id);

-- ---------- Seed campuses ----------
INSERT INTO campuses (code, name, location) VALUES
 ('GNR', 'RRU Gandhinagar Campus', 'Gandhinagar, Gujarat'),
 ('PUN', 'RRU Pune Campus',        'Pune, Maharashtra')
ON CONFLICT (code) DO NOTHING;

-- Attach the existing departments (schools) to the Gandhinagar campus.
UPDATE schools SET campus_id = (SELECT id FROM campuses WHERE code = 'GNR')
WHERE campus_id IS NULL;

-- Add a couple of departments under the Pune campus.
INSERT INTO schools (code, name, type, campus_id)
SELECT v.code, v.name, 'Department', (SELECT id FROM campuses WHERE code='PUN')
FROM (VALUES
  ('SCSF','School of Cyber Security & Digital Forensics'),
  ('SIS','School of Internal Security & Police Administration')
) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM schools s WHERE s.code = v.code);

-- ---------- Seed users for the new roles (password: Passw0rd!) ----------
-- Gandhinagar campus director
INSERT INTO users (name, email, password_hash, role_code, campus_id)
SELECT 'GNR Campus Director','gnr.director@rru.ac.in','$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di','campus_director',
       (SELECT id FROM campuses WHERE code='GNR')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='gnr.director@rru.ac.in');

-- Pune campus director
INSERT INTO users (name, email, password_hash, role_code, campus_id)
SELECT 'PUN Campus Director','pun.director@rru.ac.in','$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di','campus_director',
       (SELECT id FROM campuses WHERE code='PUN')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='pun.director@rru.ac.in');

-- Department director over SASET (Gandhinagar)
INSERT INTO users (name, email, password_hash, role_code, campus_id, school_id)
SELECT 'SASET Dept Director','saset.director@rru.ac.in','$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di','department_director',
       (SELECT id FROM campuses WHERE code='GNR'), (SELECT id FROM schools WHERE code='SASET')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='saset.director@rru.ac.in');

-- Department coordinator for SCSF (Pune)
INSERT INTO users (name, email, password_hash, role_code, campus_id, school_id)
SELECT 'SCSF Coordinator','scsf.coord@rru.ac.in','$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di','department_coordinator',
       (SELECT id FROM campuses WHERE code='PUN'), (SELECT id FROM schools WHERE code='SCSF')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='scsf.coord@rru.ac.in');

-- ---------- Wire up directors ----------
UPDATE campuses SET director_id = (SELECT id FROM users WHERE email='gnr.director@rru.ac.in') WHERE code='GNR' AND director_id IS NULL;
UPDATE campuses SET director_id = (SELECT id FROM users WHERE email='pun.director@rru.ac.in') WHERE code='PUN' AND director_id IS NULL;
UPDATE schools  SET director_id = (SELECT id FROM users WHERE email='saset.director@rru.ac.in') WHERE code='SASET' AND director_id IS NULL;

-- Give the existing campus-level users a home campus and set the existing
-- school_coordinator's campus to match its department.
UPDATE users u SET campus_id = s.campus_id FROM schools s
WHERE u.school_id = s.id AND u.campus_id IS NULL;
