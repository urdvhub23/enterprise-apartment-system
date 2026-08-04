const express = require('express');
const ChatMessage = require('../../models/mongo/ChatMessage');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// threadId convention: `${tenantId}__support`
router.get('/:threadId', authenticate, async (req, res, next) => {
  try {
    const messages = await ChatMessage.find({ threadId: req.params.threadId })
      .sort({ createdAt: 1 })
      .limit(200);
    res.json({ messages });
  } catch (err) { next(err); }
});

router.post('/:threadId', authenticate, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const doc = await ChatMessage.create({
      threadId: req.params.threadId,
      senderId: req.user.id,
      senderRole: req.user.role === 'tenant' ? 'tenant' : 'staff',
      message,
      readBy: [req.user.id]
    });

    const io = req.app.get('io');
    if (io) io.to(req.params.threadId).emit('chat:message', doc);

    res.status(201).json({ message: doc });
  } catch (err) { next(err); }
});

module.exports = router;
