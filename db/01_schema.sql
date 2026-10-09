-- =====================================================================
-- RRU Academic & Administrative Audit (AAA) Portal — Core Schema
-- Modeled on the RRU IQAC AAA framework: Criteria -> Key Indicators ->
-- Metrics (Quantitative/Qualitative), scored 0-4, submitted by School/
-- Campus, validated by RRU IQAC (DVV), assessed by Peer Team.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- ROLES & USERS
-- ---------------------------------------------------------------------
-- Role set is intentionally an enum-like lookup table (not a hard enum)
-- so new roles can be added later without a migration that rewrites a
-- Postgres ENUM type.
CREATE TABLE roles (
    code        VARCHAR(40) PRIMARY KEY,
    label       VARCHAR(120) NOT NULL,
    description TEXT
);

INSERT INTO roles (code, label, description) VALUES
    ('super_admin',        'Super Admin',                'Full control: users, master data (criteria/KI/metrics), audit cycles'),
    ('iqac',                'RRU IQAC',                  'Central Quality Assurance Cell: runs DVV validation, manages audit cycle, cross-school analytics, final approval'),
    ('school_coordinator',  'School/Campus Coordinator', 'Owns AAA submission for one School/Campus'),
    ('faculty',             'Faculty / Data Entry',      'Enters data & uploads evidence under a School Coordinator'),
    ('peer_team',           'Peer Team',                 'External reviewer assessing Qualitative Metrics during visit'),
    ('viewer',               'Leadership / Viewer',      'Read-only cross-institution dashboards (VC/Registrar etc.)');

CREATE TABLE schools (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30) UNIQUE NOT NULL,      -- e.g. 'SASET', 'CCS'
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50) DEFAULT 'School',      -- School / Campus / Centre
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_code     VARCHAR(40) NOT NULL REFERENCES roles(code),
    school_id     UUID REFERENCES schools(id),     -- NULL for iqac/super_admin/peer_team/viewer
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_role ON users(role_code);

-- ---------------------------------------------------------------------
-- AUDIT CYCLE (an annual/periodic AAA round)
-- ---------------------------------------------------------------------
CREATE TABLE audit_cycles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(150) NOT NULL,           -- e.g. 'AAA 2025-26'
    academic_year VARCHAR(20) NOT NULL,
    status        VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft/open/dvv/peer_visit/closed
    start_date    DATE,
    end_date      DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- CRITERIA -> KEY INDICATORS -> METRICS (master data, versionable per cycle)
-- ---------------------------------------------------------------------
CREATE TABLE criteria (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(10) NOT NULL,              -- '1'..'7'
    title       VARCHAR(255) NOT NULL,
    max_score   NUMERIC(6,2) NOT NULL DEFAULT 0,
    sort_order  INT NOT NULL DEFAULT 0,
    UNIQUE(code)
);

CREATE TABLE key_indicators (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criterion_id UUID NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
    code         VARCHAR(10) NOT NULL,              -- '1.1', '1.2' ...
    title        VARCHAR(255) NOT NULL,
    weightage    NUMERIC(6,2) NOT NULL DEFAULT 0,
    sort_order   INT NOT NULL DEFAULT 0,
    UNIQUE(criterion_id, code)
);

CREATE TABLE metrics (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_indicator_id  UUID NOT NULL REFERENCES key_indicators(id) ON DELETE CASCADE,
    code              VARCHAR(15) NOT NULL,          -- '1.2.1'
    title             TEXT NOT NULL,
    metric_type       VARCHAR(5) NOT NULL CHECK (metric_type IN ('QnM','QlM')),
    max_score         NUMERIC(6,2) NOT NULL DEFAULT 0,
    documents_required TEXT,                          -- from SOP: docs needed for verification
    requires_document  BOOLEAN NOT NULL DEFAULT false, -- if true, submission is blocked until >=1 evidence file uploaded
    instructions        TEXT,                          -- from SOP: specific instructions to schools
    not_to_be_included   TEXT,                          -- from SOP: exclusions
    sort_order        INT NOT NULL DEFAULT 0,
    UNIQUE(key_indicator_id, code)
);

-- Scoring bands per metric, e.g. band 4: ">=20%", band 3: "15-20%" ... (from Benchmarks doc)
CREATE TABLE metric_benchmarks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id   UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
    band        SMALLINT NOT NULL CHECK (band BETWEEN 0 AND 4),
    description TEXT NOT NULL,
    UNIQUE(metric_id, band)
);

-- ---------------------------------------------------------------------
-- SUBMISSIONS: one School's response to one Metric in one Audit Cycle
-- ---------------------------------------------------------------------
CREATE TABLE submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id  UUID NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
    metric_id       UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    response_text   TEXT,               -- qualitative narrative / quantitative figure + method
    self_score      NUMERIC(6,2),       -- school's own claimed band/score
    verified_score  NUMERIC(6,2),       -- IQAC/Peer-Team finalized score
    status          VARCHAR(30) NOT NULL DEFAULT 'draft',
        -- draft -> submitted -> dvv_review -> clarification_requested -> dvv_verified
        -- -> peer_review -> finalized
    submitted_by    UUID REFERENCES users(id),
    submitted_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(audit_cycle_id, metric_id, school_id)
);

CREATE INDEX idx_submissions_school_cycle ON submissions(school_id, audit_cycle_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- ---------------------------------------------------------------------
-- EVIDENCE DOCUMENTS (stored in self-hosted object storage / MinIO)
-- ---------------------------------------------------------------------
CREATE TABLE evidence_documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id  UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    file_name      VARCHAR(500) NOT NULL,
    storage_key    TEXT NOT NULL,        -- object key in MinIO bucket
    content_type   VARCHAR(150),
    size_bytes     BIGINT,
    uploaded_by    UUID REFERENCES users(id),
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_submission ON evidence_documents(submission_id);

-- ---------------------------------------------------------------------
-- REVIEW / DVV CLARIFICATION THREAD
-- ---------------------------------------------------------------------
CREATE TABLE review_comments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id  UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    author_id      UUID NOT NULL REFERENCES users(id),
    role_code      VARCHAR(40) NOT NULL REFERENCES roles(code),
    comment        TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_submission ON review_comments(submission_id);

-- ---------------------------------------------------------------------
-- AUDIT LOG (lightweight, append-only — who changed what)
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID REFERENCES users(id),
    action       VARCHAR(100) NOT NULL,
    entity_type  VARCHAR(60) NOT NULL,
    entity_id    UUID,
    details      JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ---------------------------------------------------------------------
-- TASKS / ASSIGNMENTS
-- A higher authority (super_admin, iqac, or a coordinator over own faculty)
-- assigns a task or requests a document/clarification from a specific user,
-- optionally tied to a Metric/Criterion and School, with a due date. On
-- completion the system records whether it was on time or delayed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id  UUID REFERENCES audit_cycles(id) ON DELETE CASCADE,
    metric_id       UUID REFERENCES metrics(id) ON DELETE SET NULL,
    submission_id   UUID REFERENCES submissions(id) ON DELETE SET NULL,
    school_id       UUID REFERENCES schools(id) ON DELETE CASCADE,
    task_type       VARCHAR(30) NOT NULL DEFAULT 'general'
                    CHECK (task_type IN ('document_request','clarification','update','general')),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    assigned_by     UUID NOT NULL REFERENCES users(id),
    assigned_to     UUID NOT NULL REFERENCES users(id),
    due_date        DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','completed','cancelled')),
    completed_at    TIMESTAMPTZ,
    completion_state VARCHAR(10) CHECK (completion_state IN ('on_time','delayed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by, status);
CREATE INDEX IF NOT EXISTS idx_tasks_metric ON tasks(metric_id);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- In-app notifications: task assigned -> notify assignee; task completed
-- -> notify assigner (with on-time/delayed); plus general messages.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(30) NOT NULL,   -- task_assigned / task_completed / task_updated
    task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
