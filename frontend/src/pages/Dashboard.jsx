import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../AuthContext';
import StatusStamp from '../components/StatusStamp';

export default function Dashboard() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auditCycles().then((rows) => { setCycles(rows); if (rows[0]) setCycleId(rows[0].id); });
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    api.dashboardSummary({ audit_cycle_id: cycleId }).then(setSummary).finally(() => setLoading(false));
  }, [cycleId]);

  const isUniversity = ['super_admin', 'iqac', 'peer_team', 'viewer'].includes(user.role);
  const scopeLine = isUniversity
    ? 'University-wide view across all campuses and departments.'
    : user.role === 'campus_director'
      ? `Campus view — departments within ${user.campus_name || 'your campus'}.`
      : 'Department view — your own department.';

  return (
    <div>
      <div className="page-kicker">Overview</div>
      <h1 className="page-title">Audit Dashboard</h1>
      <p className="muted" style={{ marginBottom: 20 }}>{scopeLine}</p>

      {cycles.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <label>Audit cycle</label>
          <select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
          </select>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}

      {!loading && summary && (
        <>
          <div className="card">
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>By status</strong>
            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {summary.byStatus.length === 0 && <span className="muted">No submissions yet for this cycle.</span>}
              {summary.byStatus.map((s) => (
                <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusStamp status={s.status} /> <span className="muted">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {isUniversity && summary.byCampus && summary.byCampus.length > 0 && (
            <div className="card">
              <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>By Campus</strong>
              <div style={{ marginTop: 8 }}>
                {summary.byCampus.map((c) => (
                  <div className="ledger-row" key={c.campus_name}>
                    <span className="ledger-code">⌂</span>
                    <span className="ledger-title">{c.campus_name} <span className="muted">· {c.departments} dept(s)</span></span>
                    <span className="muted">{c.finalized} / {c.total} finalized</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>By Department</strong>
            <div style={{ marginTop: 8 }}>
              {summary.byDepartment.length === 0 && <span className="muted">No department activity yet.</span>}
              {summary.byDepartment.map((d) => (
                <div className="ledger-row" key={(d.campus_name || '') + d.department_name}>
                  <span className="ledger-title">
                    {d.department_name}
                    {isUniversity && d.campus_name ? <span className="muted"> · {d.campus_name}</span> : ''}
                  </span>
                  <span className="muted">{d.finalized} / {d.total} finalized</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
