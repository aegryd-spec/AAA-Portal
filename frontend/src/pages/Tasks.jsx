import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../AuthContext';

const TYPE_LABEL = {
  document_request: 'Document requested',
  clarification: 'Clarification',
  update: 'Update',
  general: 'Task',
};

function TaskCard({ task, box, onChange }) {
  const [busy, setBusy] = useState(false);
  const overdue = task.due_date && task.status !== 'completed' && task.status !== 'cancelled'
    && new Date(task.due_date) < new Date(new Date().toDateString());

  async function act(fn) {
    setBusy(true);
    try { await fn(); await onChange(); } finally { setBusy(false); }
  }

  return (
    <div className="card task-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <span className={`task-type ${task.task_type}`}>{TYPE_LABEL[task.task_type]}</span>
          <strong style={{ marginLeft: 8, fontSize: 15 }}>{task.title}</strong>
        </div>
        <TaskStatus task={task} overdue={overdue} />
      </div>

      {task.description && <p className="muted" style={{ margin: '8px 0' }}>{task.description}</p>}

      <div className="muted" style={{ fontSize: 12.5, display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
        {task.metric_code && <span>Metric {task.metric_code}</span>}
        {task.school_name && <span>{task.school_name}</span>}
        {box === 'inbox'
          ? <span>Assigned by <strong>{task.assigned_by_name}</strong> ({task.assigned_by_role})</span>
          : <span>Assigned to <strong>{task.assigned_to_name}</strong> ({task.assigned_to_role})</span>}
        {task.due_date && <span style={{ color: overdue ? 'var(--alert)' : 'inherit' }}>Due {String(task.due_date).slice(0, 10)}</span>}
      </div>

      <div style={{ marginTop: 12 }}>
        {box === 'inbox' && task.status === 'open' && (
          <button className="btn secondary" disabled={busy} onClick={() => act(() => api.startTask(task.id))} style={{ marginRight: 8 }}>
            Start working
          </button>
        )}
        {box === 'inbox' && ['open', 'in_progress'].includes(task.status) && (
          <button className="btn verify" disabled={busy} onClick={() => act(() => api.completeTask(task.id))}>
            Mark complete
          </button>
        )}
        {box === 'outbox' && ['open', 'in_progress'].includes(task.status) && (
          <button className="btn alert" disabled={busy} onClick={() => act(() => api.cancelTask(task.id))}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function TaskStatus({ task, overdue }) {
  if (task.status === 'completed') {
    const on = task.completion_state === 'on_time';
    return <span className={`stamp ${on ? 'dvv_verified' : 'clarification_requested'}`}>{on ? 'Completed · on time' : 'Completed · delayed'}</span>;
  }
  if (task.status === 'cancelled') return <span className="stamp draft">Cancelled</span>;
  if (overdue) return <span className="stamp clarification_requested">Overdue</span>;
  if (task.status === 'in_progress') return <span className="stamp submitted">In progress</span>;
  return <span className="stamp draft">Open</span>;
}

export default function Tasks() {
  const { user } = useAuth();
  const [box, setBox] = useState('inbox');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const canAssign = ['super_admin', 'iqac', 'school_coordinator'].includes(user.role);

  async function load() {
    setLoading(true);
    try { setTasks(await api.tasks({ box })); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [box]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="page-kicker">Assignments</div>
      <h1 className="page-title">My Tasks</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Requests for documents, clarifications and updates. Assign new ones from a metric on the Criteria &amp; Metrics screen.
      </p>

      <div className="tabbar">
        <button className={box === 'inbox' ? 'active' : ''} onClick={() => setBox('inbox')}>Assigned to me</button>
        {canAssign && <button className={box === 'outbox' ? 'active' : ''} onClick={() => setBox('outbox')}>Assigned by me</button>}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && tasks.length === 0 && (
        <div className="card"><span className="muted">
          {box === 'inbox' ? 'No tasks assigned to you.' : 'You haven\u2019t assigned any tasks yet.'}
        </span></div>
      )}
      {!loading && tasks.map((t) => <TaskCard key={t.id} task={t} box={box} onChange={load} />)}
    </div>
  );
}
