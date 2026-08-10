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
    api.auditCycles().then((rows) => {
      setCycles(rows);
      if (rows[0]) setCycleId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    api.dashboardSummary({ audit_cycle_id: cycleId }).then(setSummary).finally(() => setLoading(false));
  }, [cycleId]);

  const cycle = cycles.find((c) => c.id === cycleId);

  return (
    <div>
      <div className="page-kicker">Overview</div>
      <h1 className="page-title">Audit Cycle Dashboard</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {user?.role === 'school_coordinator' || user?.role === 'faculty'
          ? `Submission status for ${user.school_name}.`
          : 'Institution-wide submission status across all Schools/Campuses.'}
      </p>

      {cycles.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <label>Audit cycle</label>
          <select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
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

          {summary.bySchool.length > 0 && (
            <div className="card">
              <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>By School / Campus</strong>
              <div style={{ marginTop: 8 }}>
                {summary.bySchool.map((s) => (
                  <div className="ledger-row" key={s.school_name}>
                    <div className="ledger-title">{s.school_name}</div>
                    <div className="muted">{s.finalized} / {s.total} finalized</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
