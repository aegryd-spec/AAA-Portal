import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Admin() {
  const [schools, setSchools] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role_code: '', school_id: '' });

  function refresh() {
    api.schools().then(setSchools);
    api.users().then(setUsers).catch(() => {});
    api.roles().then(setRoles);
  }
  useEffect(refresh, []);

  async function createUser(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createUser({ ...form, school_id: form.school_id || null });
      setForm({ name: '', email: '', password: '', role_code: '', school_id: '' });
      refresh();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <div className="page-kicker">Administration</div>
      <h1 className="page-title">Users, Schools &amp; Cycles</h1>

      <div className="card">
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>Schools / Campuses</strong>
        {schools.map((s) => (
          <div className="ledger-row" key={s.id}>
            <span className="ledger-code">{s.code}</span>
            <span className="ledger-title">{s.name}</span>
            <span className="muted">{s.type}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>Users</strong>
        {users.map((u) => (
          <div className="ledger-row" key={u.id}>
            <span className="ledger-title">{u.name} <span className="muted">({u.email})</span></span>
            <span className="muted">{u.role_code}{u.school_name ? ` · ${u.school_name}` : ''}</span>
          </div>
        ))}

        <hr className="divider" />
        <strong style={{ fontSize: 13 }}>Add user</strong>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={createUser} style={{ marginTop: 10 }}>
          <div className="grid-2">
            <div>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
          </div>
          <div className="grid-2">
            <div>
              <label>Temporary password</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label>Role</label>
              <select value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })} required>
                <option value="">Select…</option>
                {roles.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <label>School / Campus (leave blank for IQAC / Admin / Peer Team / Viewer)</label>
          <select value={form.school_id} onChange={(e) => setForm({ ...form, school_id: e.target.value })}>
            <option value="">— none —</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn seal" type="submit">Create user</button>
        </form>
      </div>
    </div>
  );
}
