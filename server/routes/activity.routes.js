// server/routes/activity.routes.js
const router = require('express').Router();
const { query } = require('../db');
const { authRequired } = require('../middleware/auth');
const { wrap } = require('../util');

router.use(authRequired);

// GET /api/activity?limit=40
router.get('/', wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 100);
  const rows = await query(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ${limit}`);
  res.json(rows.map(a => ({ id: String(a.id), type: a.type, text: a.message, actor: a.actor, at: a.created_at })));
}));

module.exports = router;
