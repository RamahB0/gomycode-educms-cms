const { verifyToken } = require('../utils/auth');
const { errorResponse } = require('../utils/helpers');

// Role hierarchy used for "at least this role" checks. Higher number = more
// privilege. EduCMS's four roles, from the spec: admin > editor > author > subscriber.
const ROLE_RANK = { subscriber: 0, author: 1, editor: 2, admin: 3 };

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json(errorResponse('Missing bearer token'));
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch (err) {
    return res.status(401).json(errorResponse('Invalid or expired token'));
  }
}

// requireRole('editor') passes for editor AND admin (anything ranked >= editor).
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json(errorResponse('Not authenticated'));
    const userRank = ROLE_RANK[req.user.role] ?? -1;
    const minRank = ROLE_RANK[minRole] ?? Infinity;
    if (userRank < minRank) {
      return res.status(403).json(errorResponse(`Requires role >= ${minRole}`));
    }
    return next();
  };
}

// Optional auth: attaches req.user if a valid token is present, but doesn't
// reject the request otherwise. Useful for endpoints like "list comments"
// where behavior differs slightly for logged-in users but anonymous access
// is still allowed.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch (err) {
      // ignore - treat as anonymous
    }
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth, ROLE_RANK };
