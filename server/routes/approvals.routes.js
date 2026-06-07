// server/routes/approvals.routes.js
const router = require('express').Router();
const { query, transaction } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logActivity, pad4, tmpCode, wrap } = require('../util');

router.use(authRequired);

// GET /api/approvals  (pending + history)
router.get('/', requireRole('officer', 'manager', 'admin'), wrap(async (req, res) => {
  const rows = await query(
    `SELECT a.*, r.code AS rfq_code, r.title AS rfq_title, r.quantity,
            q.unit_price, q.delivery_days, v.name AS vendor_name, u.name AS decided_by_name
     FROM approvals a
     JOIN rfqs r       ON r.id = a.rfq_id
     JOIN quotations q ON q.id = a.quotation_id
     JOIN vendors v    ON v.id = q.vendor_id
     LEFT JOIN users u ON u.id = a.decided_by
     ORDER BY a.created_at DESC`
  );
  res.json(rows);
}));

// POST /api/approvals/:id/decide  { decision, remark }
// On approval: a PO + Invoice are generated atomically in one transaction.
router.post('/:id/decide', requireRole('manager', 'admin'), wrap(async (req, res) => {
  const { decision, remark = '' } = req.body;
  if (!['Approved', 'Rejected'].includes(decision))
    return res.status(400).json({ error: 'Decision must be Approved or Rejected' });

  const [approval] = await query('SELECT * FROM approvals WHERE id = ?', [req.params.id]);
  if (!approval) return res.status(404).json({ error: 'Approval not found' });
  if (approval.state !== 'Under Review')
    return res.status(409).json({ error: 'This approval has already been decided' });

  const out = await transaction(async (conn) => {
    await conn.execute(
      'UPDATE approvals SET state = ?, remark = ?, decided_by = ?, decided_at = NOW() WHERE id = ?',
      [decision, String(remark).slice(0, 1000), req.user.id, req.params.id]
    );

    if (decision === 'Rejected') {
      await conn.execute("UPDATE rfqs SET status = 'Open' WHERE id = ?", [approval.rfq_id]);
      await conn.execute("UPDATE quotations SET status = 'Rejected' WHERE id = ?", [approval.quotation_id]);
      return { decision };
    }

    // ---- Approved → generate PO + Invoice ----
    const [rfqRows] = await conn.execute('SELECT * FROM rfqs WHERE id = ?', [approval.rfq_id]);
    const [quoteRows] = await conn.execute('SELECT * FROM quotations WHERE id = ?', [approval.quotation_id]);
    const rfq = rfqRows[0];
    const quote = quoteRows[0];

    const tmp = tmpCode();
    const [po] = await conn.execute(
      'INSERT INTO purchase_orders (code, rfq_id, quotation_id, vendor_id, quantity, unit_price, status) VALUES (?,?,?,?,?,?,?)',
      [tmp, rfq.id, quote.id, quote.vendor_id, rfq.quantity, quote.unit_price, 'Issued']
    );
    const num = po.insertId;                         // id-derived, collision-free
    const poCode = 'PO-2026-' + pad4(num);
    const invCode = 'INV-2026-' + pad4(num);
    await conn.execute('UPDATE purchase_orders SET code = ? WHERE id = ?', [poCode, num]);

    const subtotal = Number(quote.unit_price) * rfq.quantity;
    const taxRate = 18;
    const taxAmount = +(subtotal * taxRate / 100).toFixed(2);
    const total = +(subtotal + taxAmount).toFixed(2);
    await conn.execute(
      'INSERT INTO invoices (code, po_id, vendor_id, subtotal, tax_rate, tax_amount, total, status) VALUES (?,?,?,?,?,?,?,?)',
      [invCode, num, quote.vendor_id, subtotal, taxRate, taxAmount, total, 'Issued']
    );

    await conn.execute("UPDATE rfqs SET status = 'Completed' WHERE id = ?", [rfq.id]);
    await conn.execute("UPDATE quotations SET status = 'Awarded' WHERE id = ?", [quote.id]);
    await conn.execute("UPDATE quotations SET status = 'Rejected' WHERE rfq_id = ? AND id <> ?", [rfq.id, quote.id]);

    return { decision, rfqCode: rfq.code, poCode, invCode, total };
  });

  if (out.decision === 'Approved') {
    await logActivity('approve', `<b>${out.rfqCode}</b> approved by ${req.user.name}`, req.user.name, out.rfqCode);
    await logActivity('po', `Purchase order <b>${out.poCode}</b> auto-generated`, 'System', out.poCode);
    await logActivity('invoice', `Invoice <b>${out.invCode}</b> generated`, 'System', out.invCode);
  } else {
    const [rfq] = await query('SELECT code FROM rfqs WHERE id = ?', [approval.rfq_id]);
    await logActivity('approve', `<b>${rfq.code}</b> rejected by ${req.user.name}`, req.user.name, rfq.code);
  }
  res.json(out);
}));

module.exports = router;
