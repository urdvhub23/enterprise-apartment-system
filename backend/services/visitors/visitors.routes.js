const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Visitor = require('../../models/Visitor');
const { authenticate, authorize } = require('../../middleware/auth');
const { resolveSocietyScope } = require('../../middleware/tenantScope');
const { notifyUser } = require('../notifications/notifications.service');

const router = express.Router();
const STAFF_ROLES = ['super_admin', 'property_manager', 'staff'];

router.use(authenticate, resolveSocietyScope);

function generateQrToken() {
  return crypto.randomBytes(16).toString('hex');
}

// ---- Resident: pre-register a visitor, get back a time-limited QR token ----
router.post(
  '/',
  [
    body('apartment_id').isUUID(),
    body('visitor_name').notEmpty(),
    body('valid_from').isISO8601(),
    body('valid_until').isISO8601()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { apartment_id, visitor_name, visitor_phone, purpose, valid_from, valid_until } = req.body;

      if (new Date(valid_until) <= new Date(valid_from)) {
        return res.status(400).json({ error: 'valid_until must be after valid_from' });
      }
      // Cap validity window so a QR can't be generated to stay valid indefinitely.
      const maxWindowMs = 72 * 60 * 60 * 1000; // 72h
      if (new Date(valid_until) - new Date(valid_from) > maxWindowMs) {
        return res.status(400).json({ error: 'Visitor passes can be valid for a maximum of 72 hours' });
      }

      const visitor = await Visitor.create({
        society_id: req.societyId,
        host_resident_id: req.user.id,
        apartment_id,
        visitor_name,
        visitor_phone,
        purpose: purpose || 'guest',
        qr_token: generateQrToken(),
        valid_from,
        valid_until,
        status: 'pending'
      });

      // qr_token is what gets encoded into an actual QR image client-side
      // (e.g. with the `qrcode` npm package on web, or ZXing on Android) —
      // this endpoint just issues the token and validity window.
      res.status(201).json({ visitor });
    } catch (err) { next(err); }
  }
);

// ---- Resident: list visitors they've registered ----
router.get('/mine', async (req, res, next) => {
  try {
    const visitors = await Visitor.findAll({
      where: { host_resident_id: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json({ visitors });
  } catch (err) { next(err); }
});

// ---- Gate staff: look up + validate a scanned QR token ----
router.get('/lookup/:token', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const visitor = await Visitor.findOne({ where: { qr_token: req.params.token, society_id: req.societyId } });
    if (!visitor) return res.status(404).json({ error: 'No visitor pass found for this code' });

    const now = new Date();
    if (visitor.status === 'cancelled') return res.status(409).json({ error: 'This pass was cancelled', visitor });
    if (now < visitor.valid_from) return res.status(409).json({ error: 'This pass is not valid yet', visitor });
    if (now > visitor.valid_until) return res.status(409).json({ error: 'This pass has expired', visitor });

    res.json({ visitor, valid: true });
  } catch (err) { next(err); }
});

// ---- Gate staff: check a visitor in or out ----
router.patch('/:id/check-in', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });

    visitor.status = 'checked_in';
    visitor.checked_in_at = new Date();
    visitor.logged_by_staff_id = req.user.id;
    visitor.entry_method = req.body.entry_method || 'manual'; // qr_scan | manual | rfid | biometric
    await visitor.save();

    await notifyUser(visitor.host_resident_id, {
      channel: 'push',
      type: 'notice_posted',
      title: 'Visitor checked in',
      body: `${visitor.visitor_name} checked in at the gate.`,
      metadata: { visitorId: visitor.id }
    });

    res.json({ visitor });
  } catch (err) { next(err); }
});

router.patch('/:id/check-out', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });

    visitor.status = 'checked_out';
    visitor.checked_out_at = new Date();
    await visitor.save();
    res.json({ visitor });
  } catch (err) { next(err); }
});

// ---- Gate staff: manual walk-in log (no pre-registered QR) ----
router.post('/manual-log', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const { apartment_id, host_resident_id, visitor_name, visitor_phone, purpose, entry_method } = req.body;
    const visitor = await Visitor.create({
      society_id: req.societyId,
      host_resident_id,
      apartment_id,
      visitor_name,
      visitor_phone,
      purpose: purpose || 'other',
      qr_token: generateQrToken(), // still issued for consistency/record-keeping
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 12 * 60 * 60 * 1000),
      status: 'checked_in',
      checked_in_at: new Date(),
      logged_by_staff_id: req.user.id,
      entry_method: entry_method || 'manual'
    });
    res.status(201).json({ visitor });
  } catch (err) { next(err); }
});

// ---- Offline-first sync: gate PWA queues entries locally when the network
// drops, then POSTs them here as a batch once connectivity returns. Each
// entry carries a client-generated idempotency key so a retried sync after
// a partial failure can't create duplicate log entries. ----
router.post('/sync-batch', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const { entries } = req.body; // [{ clientId, apartment_id, host_resident_id, visitor_name, purpose, entry_method, occurred_at }, ...]
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries must be a non-empty array' });
    }

    const results = [];
    for (const entry of entries) {
      // clientId lets the PWA mark this row synced locally and avoid re-sending it.
      const existing = await Visitor.findOne({ where: { qr_token: `manual-${entry.clientId}` } });
      if (existing) { results.push({ clientId: entry.clientId, visitorId: existing.id, status: 'already_synced' }); continue; }

      const visitor = await Visitor.create({
        society_id: req.societyId,
        host_resident_id: entry.host_resident_id,
        apartment_id: entry.apartment_id,
        visitor_name: entry.visitor_name,
        visitor_phone: entry.visitor_phone,
        purpose: entry.purpose || 'other',
        qr_token: `manual-${entry.clientId}`, // deterministic token = idempotency key
        valid_from: entry.occurred_at || new Date(),
        valid_until: new Date(new Date(entry.occurred_at || Date.now()).getTime() + 12 * 60 * 60 * 1000),
        status: 'checked_in',
        checked_in_at: entry.occurred_at || new Date(),
        logged_by_staff_id: req.user.id,
        entry_method: entry.entry_method || 'manual'
      });
      results.push({ clientId: entry.clientId, visitorId: visitor.id, status: 'synced' });
    }

    res.status(201).json({ results });
  } catch (err) { next(err); }
});

// ---- Flag/unflag a frequent visitor (recurring delivery driver, vendor) ----
router.patch('/:id/frequent', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
    visitor.is_frequent_flag = req.body.is_frequent_flag !== false;
    await visitor.save();
    res.json({ visitor });
  } catch (err) { next(err); }
});

router.get('/frequent', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const visitors = await Visitor.findAll({
      where: { society_id: req.societyId, is_frequent_flag: true },
      order: [['visitor_name', 'ASC']]
    });
    res.json({ visitors });
  } catch (err) { next(err); }
});

// ---- Today's gate activity (for staff PWA landing view) ----
router.get('/today', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const visitors = await Visitor.findAll({
      where: { society_id: req.societyId, createdAt: { [Op.gte]: startOfDay } },
      order: [['createdAt', 'DESC']]
    });
    res.json({ visitors });
  } catch (err) { next(err); }
});

module.exports = router;
