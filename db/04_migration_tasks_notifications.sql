-- =====================================================================
-- Migration 04: task assignment + in-app notifications
-- Safe to run against an already-initialised database. Fresh installs
-- get these tables from 01_schema.sql automatically. Run manually only
-- if your DB predates this change:
--   psql -h localhost -U aaa_user -d aaa_portal -f db/04_migration_tasks_notifications.sql
-- =====================================================================

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

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(30) NOT NULL,
    task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
