const express = require('express');
const { body, validationResult } = require('express-validator');
const Complaint = require('../../models/mongo/Complaint');
const { authenticate, authorize } = require('../../middleware/auth');
const { notifyUser } = require('../notifications/notifications.service');

const router = express.Router();
const STAFF_ROLES = ['super_admin', 'property_manager', 'staff'];

// Default SLA windows per category — configurable per society later; kept
// as a simple lookup for now rather than a new DB table, since it's the
// kind of thing a committee would want to tune via settings eventually.
const SLA_HOURS_BY_CATEGORY = {
  plumbing: 24,
  electrical: 24,
  security: 4,
  cleaning: 48,
  appliance: 72,
  noise: 12,
  other: 48
};

router.get('/', authenticate, async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'tenant') filter.tenantId = req.user.id;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json({ complaints });
  } catch (err) { next(err); }
});

router.post(
  '/',
  authenticate,
  [
    body('apartmentId').notEmpty(),
    body('category').isIn(['plumbing', 'electrical', 'security', 'cleaning', 'appliance', 'noise', 'other']),
    body('title').notEmpty(),
    body('description').notEmpty()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const slaHours = SLA_HOURS_BY_CATEGORY[req.body.category] || 48;
      const complaint = await Complaint.create({
        tenantId: req.user.id,
        apartmentId: req.body.apartmentId,
        category: req.body.category,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || 'medium',
        photoUrls: req.body.photoUrls || [],
        slaHours,
        slaDueAt: new Date(Date.now() + slaHours * 60 * 60 * 1000)
      });

      res.status(201).json({ complaint });
    } catch (err) { next(err); }
  }
);

router.patch('/:id/status', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const { status, assignedStaffId } = req.body;
    const update = { status };
    if (assignedStaffId) update.assignedStaffId = assignedStaffId;
    if (status === 'resolved' || status === 'closed') update.resolvedAt = new Date();

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    await notifyUser(complaint.tenantId, {
      channel: 'in_app',
      type: 'complaint_update',
      title: 'Your complaint was updated',
      body: `"${complaint.title}" is now marked as ${status}.`,
      metadata: { complaintId: complaint._id }
    });

    res.json({ complaint });
  } catch (err) { next(err); }
});

// Committee view: tickets that have breached SLA and been auto-escalated.
router.get('/escalated', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const complaints = await Complaint.find({ escalated: true, status: { $nin: ['resolved', 'closed'] } })
      .sort({ escalatedAt: -1 });
    res.json({ complaints });
  } catch (err) { next(err); }
});

router.post('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { message, authorName } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    complaint.comments.push({ authorId: req.user.id, authorName, message });
    await complaint.save();

    res.status(201).json({ complaint });
  } catch (err) { next(err); }
});

module.exports = router;
