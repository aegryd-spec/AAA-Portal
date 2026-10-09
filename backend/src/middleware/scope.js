const pool = require('../config/db');

// University-wide roles see every campus & department.
const UNIVERSITY_ROLES = ['super_admin', 'iqac', 'peer_team', 'viewer'];

// Resolve the set of department (school) ids a user may see.
// Returns { all: true } for university-wide roles, otherwise { all: false, ids: [...] }.
async function visibleDepartmentIds(user) {
  if (UNIVERSITY_ROLES.includes(user.role)) return { all: true };

  if (user.role === 'campus_director') {
    const { rows } = await pool.query('SELECT id FROM schools WHERE campus_id = $1', [user.campus_id]);
    return { all: false, ids: rows.map((r) => r.id) };
  }

  if (user.role === 'department_director') {
    // Departments this user directs, plus their own home department if set.
    const { rows } = await pool.query(
      'SELECT id FROM schools WHERE director_id = $1 OR id = $2', [user.sub, user.school_id]);
    return { all: false, ids: rows.map((r) => r.id) };
  }

  // department_coordinator, faculty, legacy school_coordinator
  return { all: false, ids: user.school_id ? [user.school_id] : [] };
}

// Build a SQL fragment "<col> IN ($n, $n+1, ...)" appended to params; returns
// { clause, params } where clause is '' for university-wide (no restriction).
function departmentFilter(scope, col, startIndex) {
  if (scope.all) return { clause: '', params: [] };
  if (scope.ids.length === 0) return { clause: `${col} IN (NULL)`, params: [] }; // matches nothing
  const placeholders = scope.ids.map((_, i) => `$${startIndex + i}`).join(',');
  return { clause: `${col} IN (${placeholders})`, params: scope.ids };
}

module.exports = { visibleDepartmentIds, departmentFilter, UNIVERSITY_ROLES };
