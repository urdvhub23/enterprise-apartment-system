const express = require('express');
const { body, validationResult } = require('express-validator');
const Notice = require('../../models/mongo/Notice');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const STAFF_ROLES = ['super_admin', 'property_manager', 'staff'];

router.get('/', authenticate, async (req, res, next) => {
  try {
    const notices = await Notice.find({
      $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }]
    }).sort({ pinned: -1, createdAt: -1 });
    res.json({ notices });
  } catch (err) { next(err); }
});

router.post(
  '/',
  authenticate, authorize(...STAFF_ROLES),
  [body('title').notEmpty(), body('body').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const notice = await Notice.create({
        ...req.body,
        postedByStaffId: req.user.id
      });
      res.status(201).json({ notice });
    } catch (err) { next(err); }
  }
);

router.delete('/:id', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
