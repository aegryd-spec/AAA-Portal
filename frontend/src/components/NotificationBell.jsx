import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  async function load() {
    try {
      const { notifications, unread } = await api.notifications();
      setItems(notifications);
      setUnread(unread);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // light polling
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api.markAllRead();
      setUnread(0);
      load();
    }
  }

  function icon(type) {
    if (type === 'task_assigned') return '⇩';
    if (type === 'task_completed') return '✓';
    return '•';
  }

  return (
    <span className="notif" ref={ref}>
      <button className="notif-btn" onClick={toggle} title="Notifications">
        ✉ {unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">Notifications</div>
          {items.length === 0 && <div className="notif-empty">No notifications yet.</div>}
          {items.map((n) => (
            <div className={`notif-item ${n.is_read ? '' : 'unread'}`} key={n.id}>
              <span className="notif-icon">{icon(n.type)}</span>
              <span>
                {n.message}
                <div className="notif-time">{new Date(n.created_at).toLocaleString()}</div>
              </span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
