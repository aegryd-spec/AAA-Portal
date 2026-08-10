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

// A school_coordinator/faculty user may only touch their own school's data.
// super_admin/iqac/peer_team/viewer are cross-school.
function scopeToOwnSchool(req, res, next) {
  if (['super_admin', 'iqac', 'peer_team', 'viewer'].includes(req.user.role)) {
    return next();
  }
  const requestedSchoolId = req.params.schoolId || req.body.school_id || req.query.school_id;
  if (requestedSchoolId && requestedSchoolId !== req.user.school_id) {
    return res.status(403).json({ error: 'Cannot access another school\'s data' });
  }
  next();
}

module.exports = { requireAuth, requireRole, scopeToOwnSchool, JWT_SECRET };
