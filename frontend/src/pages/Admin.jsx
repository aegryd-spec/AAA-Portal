import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../AuthContext';

export default function Admin() {
  const { user } = useAuth();
  const [campuses, setCampuses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const isUniversityAdmin = ['super_admin', 'iqac'].includes(user.role);

  const [campusForm, setCampusForm] = useState({ code: '', name: '', location: '' });
  const [deptForm, setDeptForm] = useState({ code: '', name: '', campus_id: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role_code: '', campus_id: '', school_id: '' });

  function refresh() {
    api.campuses().then(setCampuses).catch(() => {});
    api.departments().then(setDepartments).catch(() => {});
    api.users().then(setUsers).catch(() => {});
    api.roles().then(setRoles).catch(() => {});
  }
  useEffect(refresh, []);

  function flash(m) { setMsg(m); setError(''); setTimeout(() => setMsg(''), 2000); }

  async function createCampus(e) {
    e.preventDefault(); setError('');
    try { await api.createCampus(campusForm); setCampusForm({ code: '', name: '', location: '' }); flash('Campus created.'); refresh(); }
    catch (err) { setError(err.message); }
  }
  async function createDept(e) {
    e.preventDefault(); setError('');
    try { await api.createDepartment(deptForm); setDeptForm({ code: '', name: '', campus_id: '' }); flash('Department created.'); refresh(); }
    catch (err) { setError(err.message); }
  }
  async function createUser(e) {
    e.preventDefault(); setError('');
    try {
      await api.createUser({ ...userForm, campus_id: userForm.campus_id || null, school_id: userForm.school_id || null });
      setUserForm({ name: '', email: '', password: '', role_code: '', campus_id: '', school_id: '' });
      flash('User created.'); refresh();
    } catch (err) { setError(err.message); }
  }
  async function assignCoordinator(deptId, userId) {
    if (!userId) return;
    try { await api.assignDeptCoordinator(deptId, userId); flash('Coordinator assigned.'); refresh(); }
    catch (err) { setError(err.message); }
  }
  async function assignDeptDirector(deptId, userId) {
    if (!userId) return;
    try { await api.assignDeptDirector(deptId, userId); flash('Director assigned.'); refresh(); }
    catch (err) { setError(err.message); }
  }

  return (
    <div>
      <div className="page-kicker">Administration</div>
      <h1 className="page-title">Campuses, Departments &amp; Users</h1>
      {error && <div className="error-banner">{error}</div>}
      {msg && <div className="assign-msg" style={{ marginBottom: 14 }}>{msg}</div>}

      {/* CAMPUSES */}
      <div className="card">
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>Campuses (tenants)</strong>
        {campuses.map((c) => (
          <div className="ledger-row" key={c.id}>
            <span className="ledger-code">{c.code}</span>
            <span className="ledger-title">{c.name} <span className="muted">{c.location ? `· ${c.location}` : ''}</span></span>
            <span className="muted">{c.department_count} dept(s){c.director_name ? ` · Dir: ${c.director_name}` : ''}</span>
          </div>
        ))}
        {isUniversityAdmin && (
          <>
            <hr className="divider" />
            <strong style={{ fontSize: 13 }}>Add campus</strong>
            <form onSubmit={createCampus} style={{ marginTop: 10 }}>
              <div className="grid-2">
                <div><label>Code</label><input value={campusForm.code} onChange={(e) => setCampusForm({ ...campusForm, code: e.target.value })} required /></div>
                <div><label>Name</label><input value={campusForm.name} onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })} required /></div>
              </div>
              <label>Location</label>
              <input value={campusForm.location} onChange={(e) => setCampusForm({ ...campusForm, location: e.target.value })} />
              <button className="btn seal" type="submit">Create campus</button>
            </form>
          </>
        )}
      </div>

      {/* DEPARTMENTS */}
      <div className="card">
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>Departments</strong>
        {departments.map((d) => (
          <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span className="ledger-code">{d.code}</span>
              <span className="ledger-title">{d.name} <span className="muted">· {d.campus_name || '—'}</span></span>
              <span className="muted">{d.director_name ? `Dir: ${d.director_name}` : 'no director'}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <AssignControl label="Assign director" users={users}
                onAssign={(uid) => assignDeptDirector(d.id, uid)}
                filter={(u) => ['department_director', 'department_coordinator', 'faculty'].includes(u.role_code)} />
              <AssignControl label="Assign coordinator" users={users}
                onAssign={(uid) => assignCoordinator(d.id, uid)}
                filter={(u) => ['department_coordinator', 'faculty', 'school_coordinator'].includes(u.role_code)} />
            </div>
          </div>
        ))}
        {(isUniversityAdmin || user.role === 'campus_director') && (
          <>
            <hr className="divider" />
            <strong style={{ fontSize: 13 }}>Add department</strong>
            <form onSubmit={createDept} style={{ marginTop: 10 }}>
              <div className="grid-2">
                <div><label>Code</label><input value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} required /></div>
                <div><label>Name</label><input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required /></div>
              </div>
              <label>Campus</label>
              <select value={deptForm.campus_id} onChange={(e) => setDeptForm({ ...deptForm, campus_id: e.target.value })} required>
                <option value="">Select campus…</option>
                {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn seal" type="submit">Create department</button>
            </form>
          </>
        )}
      </div>

      {/* USERS */}
      {isUniversityAdmin && (
        <div className="card">
          <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>Users</strong>
          {users.map((u) => (
            <div className="ledger-row" key={u.id}>
              <span className="ledger-title">{u.name} <span className="muted">({u.email})</span></span>
              <span className="muted">{u.role_code}{u.campus_name ? ` · ${u.campus_name}` : ''}{u.school_name ? ` · ${u.school_name}` : ''}</span>
            </div>
          ))}
          <hr className="divider" />
          <strong style={{ fontSize: 13 }}>Add user</strong>
          <form onSubmit={createUser} style={{ marginTop: 10 }}>
            <div className="grid-2">
              <div><label>Name</label><input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required /></div>
              <div><label>Email</label><input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required /></div>
            </div>
            <div className="grid-2">
              <div><label>Temp password</label><input value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required /></div>
              <div><label>Role</label>
                <select value={userForm.role_code} onChange={(e) => setUserForm({ ...userForm, role_code: e.target.value })} required>
                  <option value="">Select…</option>
                  {roles.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div><label>Campus (for campus/department roles)</label>
                <select value={userForm.campus_id} onChange={(e) => setUserForm({ ...userForm, campus_id: e.target.value })}>
                  <option value="">— none —</option>
                  {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label>Department (for department roles)</label>
                <select value={userForm.school_id} onChange={(e) => setUserForm({ ...userForm, school_id: e.target.value })}>
                  <option value="">— none —</option>
                  {departments.filter((d) => !userForm.campus_id || d.campus_id === userForm.campus_id)
                    .map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn seal" type="submit">Create user</button>
          </form>
        </div>
      )}
    </div>
  );
}

function AssignControl({ label, users, onAssign, filter }) {
  const [val, setVal] = useState('');
  const options = users.filter(filter);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select value={val} onChange={(e) => setVal(e.target.value)} style={{ marginBottom: 0, fontSize: 12.5, padding: '6px 8px' }}>
        <option value="">{label}…</option>
        {options.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role_code})</option>)}
      </select>
      <button className="btn secondary" style={{ padding: '6px 10px', fontSize: 12 }}
        onClick={() => { onAssign(val); setVal(''); }} disabled={!val}>Set</button>
    </div>
  );
}
