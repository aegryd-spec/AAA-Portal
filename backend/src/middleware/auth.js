const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Usage: requireRole('super_admin', 'iqac')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role for this action' });
    }
    next();
  };
}

// Department-scope guard. University roles and the director roles are
// cross-department (their visible set is enforced where data is read);
// a coordinator/faculty user may only touch their own department's data.
function scopeToOwnSchool(req, res, next) {
  const broad = ['super_admin', 'iqac', 'peer_team', 'viewer', 'campus_director', 'department_director'];
  if (broad.includes(req.user.role)) return next();
  const requestedSchoolId = req.params.schoolId || req.body.school_id || req.query.school_id;
  if (requestedSchoolId && requestedSchoolId !== req.user.school_id) {
    return res.status(403).json({ error: "Cannot access another department's data" });
  }
  next();
}

module.exports = { requireAuth, requireRole, scopeToOwnSchool, JWT_SECRET };
