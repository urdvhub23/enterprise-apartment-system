const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../../config/postgres');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const Lease = require('../../models/Lease');
const { authenticate, authorize } = require('../../middleware/auth');
const { notifyUser } = require('../notifications/notifications.service');

const router = express.Router();
const STAFF_ROLES = ['super_admin', 'property_manager', 'staff'];

function generateInvoiceNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `INV-${stamp}`;
}

// ---- Invoices ----
router.get('/invoices', authenticate, async (req, res, next) => {
  try {
    const where = {};
    let include = [{ model: Lease, include: ['tenant', 'apartment'] }];
    if (req.user.role === 'tenant') {
      // restrict to invoices belonging to this tenant's leases
      const leases = await Lease.findAll({ where: { tenant_id: req.user.id }, attributes: ['id'] });
      where.lease_id = leases.map(l => l.id);
    }
    if (req.query.status) where.status = req.query.status;

    const invoices = await Invoice.findAll({ where, include, order: [['due_date', 'DESC']] });
    res.json({ invoices });
  } catch (err) { next(err); }
});

router.post(
  '/invoices',
  authenticate, authorize(...STAFF_ROLES),
  [
    body('lease_id').isUUID(),
    body('billing_period_start').isISO8601(),
    body('billing_period_end').isISO8601(),
    body('due_date').isISO8601(),
    body('rent_amount').isFloat({ gt: 0 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { lease_id, billing_period_start, billing_period_end, rent_amount,
              utilities_amount = 0, late_fee = 0, due_date } = req.body;

      const lease = await Lease.findByPk(lease_id);
      if (!lease) return res.status(404).json({ error: 'Lease not found' });

      const total = Number(rent_amount) + Number(utilities_amount) + Number(late_fee);

      const invoice = await Invoice.create({
        lease_id,
        invoice_number: generateInvoiceNumber(),
        billing_period_start, billing_period_end,
        rent_amount, utilities_amount, late_fee,
        total_amount: total,
        due_date,
        status: 'issued'
      });

      await notifyUser(lease.tenant_id, {
        channel: 'in_app',
        type: 'rent_due',
        title: 'New invoice issued',
        body: `Invoice ${invoice.invoice_number} for ${total} is due on ${due_date}.`,
        metadata: { invoiceId: invoice.id }
      });

      res.status(201).json({ invoice });
    } catch (err) { next(err); }
  }
);

// ---- Payments (transactional: invoice + payment updated atomically) ----
router.post(
  '/payments',
  authenticate,
  [
    body('invoice_id').isUUID(),
    body('amount').isFloat({ gt: 0 }),
    body('method').isIn(['card', 'bank_transfer', 'cash', 'upi', 'cheque'])
  ],
  async (req, res, next) => {
    // Use a DB transaction so the invoice status and the ledger entry
    // are always consistent — this is exactly why billing lives in Postgres.
    const t = await sequelize.transaction();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await t.rollback();
        return res.status(400).json({ errors: errors.array() });
      }

      const { invoice_id, amount, method, transaction_ref, receipt_url } = req.body;
      const invoice = await Invoice.findByPk(invoice_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!invoice) { await t.rollback(); return res.status(404).json({ error: 'Invoice not found' }); }
      if (invoice.status === 'paid') { await t.rollback(); return res.status(409).json({ error: 'Invoice already paid' }); }

      // Card/UPI are treated as instant (a real gateway integration would
      // confirm via webhook — see docs/ARCHITECTURE.md). Bank transfer/
      // cheque with an uploaded receipt sit as "pending" until staff verify
      // the receipt against the actual bank statement.
      const needsVerification = ['bank_transfer', 'cheque'].includes(method) && !!receipt_url;

      const payment = await Payment.create({
        invoice_id,
        amount,
        method,
        transaction_ref: transaction_ref || uuidv4(),
        receipt_url: receipt_url || null,
        status: needsVerification ? 'pending' : 'completed',
        paid_at: needsVerification ? null : new Date()
      }, { transaction: t });

      if (!needsVerification) {
        const priorPayments = await Payment.sum('amount', {
          where: { invoice_id, status: 'completed' },
          transaction: t
        });
        invoice.status = Number(priorPayments) >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';
        await invoice.save({ transaction: t });
      }

      await t.commit();

      const lease = await Lease.findByPk(invoice.lease_id);
      if (lease) {
        await notifyUser(lease.tenant_id, {
          channel: 'in_app',
          type: 'payment_received',
          title: 'Payment received',
          body: `We received your payment of ${amount} for invoice ${invoice.invoice_number}.`,
          metadata: { invoiceId: invoice.id, paymentId: payment.id }
        });
      }

      res.status(201).json({ payment, invoice });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  }
);

// Staff verifies a pending bank-transfer/cheque receipt against the bank
// statement, then confirms or rejects it.
router.patch('/payments/:id/verify', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { approve } = req.body; // true | false
    const payment = await Payment.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!payment) { await t.rollback(); return res.status(404).json({ error: 'Payment not found' }); }
    if (payment.status !== 'pending') { await t.rollback(); return res.status(409).json({ error: 'Payment is not pending verification' }); }

    payment.status = approve ? 'completed' : 'failed';
    payment.paid_at = approve ? new Date() : null;
    await payment.save({ transaction: t });

    if (approve) {
      const invoice = await Invoice.findByPk(payment.invoice_id, { transaction: t, lock: t.LOCK.UPDATE });
      const priorPayments = await Payment.sum('amount', { where: { invoice_id: invoice.id, status: 'completed' }, transaction: t });
      invoice.status = Number(priorPayments) >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';
      await invoice.save({ transaction: t });
    }

    await t.commit();
    res.json({ payment });
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

router.get('/payments', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const payments = await Payment.findAll({
      include: [{ model: Invoice }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ payments });
  } catch (err) { next(err); }
});

// Simple financial summary for admin dashboards
router.get('/summary', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const totalBilled = await Invoice.sum('total_amount') || 0;
    const totalCollected = await Payment.sum('amount', { where: { status: 'completed' } }) || 0;
    const overdueCount = await Invoice.count({ where: { status: 'overdue' } });
    res.json({
      totalBilled,
      totalCollected,
      outstanding: Number(totalBilled) - Number(totalCollected),
      overdueCount
    });
  } catch (err) { next(err); }
});

module.exports = router;
