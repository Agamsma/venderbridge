// server/middleware/auth.js — JWT signing/verification and role guards
const jwt = require('jsonwebtoken');
const { jwt: jwtCfg } = require('../config');

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, vendor_id: user.vendor_id || null },
    jwtCfg.secret,
    { expiresIn: jwtCfg.expires }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, jwtCfg.secret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: 'You do not have access to this action' });
    next();
  };
}

module.exports = { signToken, authRequired, requireRole };
