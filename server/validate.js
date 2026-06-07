// server/validate.js — minimal request validation helpers
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 160;
const isStr = (s, max = 255) => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= max;
const isNum = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const v = Number(n);
  return Number.isFinite(v) && v >= min && v <= max;
};
// Validate against a list of [condition, message]; returns error string or null
function check(rules) {
  for (const [ok, msg] of rules) if (!ok) return msg;
  return null;
}

module.exports = { isEmail, isStr, isNum, check };
