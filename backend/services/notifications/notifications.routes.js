const express = require('express');
const Notification = require('../../models/mongo/Notification');
const { authenticate } = require('../../middleware/auth');
const { notifyUser } = require('./notifications.service');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ notifications });
  } catch (err) { next(err); }
});

router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (err) { next(err); }
});

router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Broadcast a notice-driven notification (used by the notices/complaints flows)
router.post('/broadcast', authenticate, async (req, res, next) => {
  try {
    const { userIds, channel, type, title, body, metadata } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }
    const results = await Promise.all(
      userIds.map(uid => notifyUser(uid, { channel, type, title, body, metadata }))
    );
    res.status(201).json({ sent: results.filter(Boolean).length });
  } catch (err) { next(err); }
});

module.exports = router;
