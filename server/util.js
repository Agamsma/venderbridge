// server/util.js — small shared helpers
const { query } = require('./db');

// Write an audit/notification entry
async function logActivity(type, message, actor = 'System', refCode = null) {
  await query(
    'INSERT INTO activity_log (type, message, actor, ref_code) VALUES (?,?,?,?)',
    [type, message, actor, refCode]
  );
}

const pad4 = (n) => String(n).padStart(4, '0');

// Short, collision-free placeholder code (fits in VARCHAR(20)); replaced with
// the id-derived final code inside the same transaction. e.g. "TMP-l3k9f2-8a"
const tmpCode = () => 'TMP-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

// Wrap an async route handler so thrown errors hit the error middleware
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { logActivity, pad4, tmpCode, wrap };
