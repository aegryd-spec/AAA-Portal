const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('aaa_token');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  criteriaTree: () => request('/criteria'),
  schools: () => request('/admin/schools'),
  auditCycles: () => request('/admin/audit-cycles'),
  roles: () => request('/admin/roles'),
  users: () => request('/admin/users'),
  createUser: (payload) => request('/admin/users', { method: 'POST', body: payload }),
  submissions: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/submissions${qs ? `?${qs}` : ''}`);
  },
  upsertSubmission: (payload) => request('/submissions/upsert', { method: 'POST', body: payload }),
  transition: (id, to_status, verified_score) =>
    request(`/submissions/${id}/transition`, { method: 'POST', body: { to_status, verified_score } }),
  comments: (id) => request(`/submissions/${id}/comments`),
  addComment: (id, comment) => request(`/submissions/${id}/comments`, { method: 'POST', body: { comment } }),
  evidenceList: (submissionId) => request(`/evidence/${submissionId}`),
  evidenceDownload: (evidenceId) => request(`/evidence/download/${evidenceId}`),
  uploadEvidence: (submissionId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/evidence/${submissionId}`, { method: 'POST', body: form, isForm: true });
  },
  dashboardSummary: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/dashboard/summary${qs ? `?${qs}` : ''}`);
  },
  // Tasks & assignments
  assignableUsers: () => request('/tasks/assignable-users'),
  tasks: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (payload) => request('/tasks', { method: 'POST', body: payload }),
  startTask: (id) => request(`/tasks/${id}/start`, { method: 'POST' }),
  completeTask: (id) => request(`/tasks/${id}/complete`, { method: 'POST' }),
  cancelTask: (id) => request(`/tasks/${id}/cancel`, { method: 'POST' }),
  // Campuses & departments (multi-tenant)
  campuses: () => request('/campuses'),
  createCampus: (payload) => request('/campuses', { method: 'POST', body: payload }),
  assignCampusDirector: (id, user_id) => request(`/campuses/${id}/assign-director`, { method: 'POST', body: { user_id } }),
  departments: () => request('/campuses/departments'),
  createDepartment: (payload) => request('/campuses/departments', { method: 'POST', body: payload }),
  assignDeptDirector: (id, user_id) => request(`/campuses/departments/${id}/assign-director`, { method: 'POST', body: { user_id } }),
  assignDeptCoordinator: (id, user_id) => request(`/campuses/departments/${id}/assign-coordinator`, { method: 'POST', body: { user_id } }),
  // Notifications
  notifications: () => request('/notifications'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST' }),
};

export { getToken };
