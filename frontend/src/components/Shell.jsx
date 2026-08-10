import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import NotificationBell from './NotificationBell';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  iqac: 'RRU IQAC',
  school_coordinator: 'School Coordinator',
  faculty: 'Faculty',
  peer_team: 'Peer Team',
  viewer: 'Viewer',
};

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell" style={{ flexDirection: 'column' }}>
      <header className="masthead">
        <div className="crest">
          RRU AAA Portal
          <small>Rashtriya Raksha University · IQAC</small>
        </div>
        <div className="who">
          <NotificationBell />
          {user?.name} — {ROLE_LABELS[user?.role] || user?.role}
          {user?.school_name ? ` · ${user.school_name}` : ''}
          <button onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
        </div>
      </header>
      <div className="layout-body">
        <nav className="sidebar">
          <div className="toc-label">Navigate</div>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="num">·</span> Dashboard
          </NavLink>
          <NavLink to="/criteria" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="num">§</span> Criteria &amp; Metrics
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="num">✦</span> My Tasks
          </NavLink>
          {['super_admin', 'iqac'].includes(user?.role) && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="num">⚙</span> Administration
            </NavLink>
          )}
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
