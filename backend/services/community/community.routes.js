const express = require('express');
const { body, validationResult } = require('express-validator');
const DiscussionPost = require('../../models/mongo/DiscussionPost');
const { authenticate, authorize } = require('../../middleware/auth');
const { resolveSocietyScope } = require('../../middleware/tenantScope');

const router = express.Router();
const STAFF_ROLES = ['super_admin', 'property_manager', 'staff'];

router.use(authenticate, resolveSocietyScope);

router.get('/', async (req, res, next) => {
  try {
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const filter = { societyId: req.societyId };
    // Residents don't see removed posts; staff can see everything to moderate.
    if (!isStaff) filter.status = { $ne: 'removed' };
    if (req.query.category) filter.category = req.query.category;

    const posts = await DiscussionPost.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ posts });
  } catch (err) { next(err); }
});

router.post(
  '/',
  [body('title').notEmpty(), body('body').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const post = await DiscussionPost.create({
        societyId: req.societyId,
        authorId: req.user.id,
        authorName: req.body.authorName || 'Resident',
        title: req.body.title,
        body: req.body.body,
        category: req.body.category || 'general'
      });
      res.status(201).json({ post });
    } catch (err) { next(err); }
  }
);

router.post('/:id/replies', [body('body').notEmpty()], async (req, res, next) => {
  try {
    const post = await DiscussionPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.replies.push({
      authorId: req.user.id,
      authorName: req.body.authorName || 'Resident',
      body: req.body.body
    });
    await post.save();
    res.status(201).json({ post });
  } catch (err) { next(err); }
});

// ---- Moderation (staff only) ----
router.patch('/:id/moderate', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const { status } = req.body; // 'visible' | 'flagged' | 'removed'
    const post = await DiscussionPost.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ post });
  } catch (err) { next(err); }
});

router.patch('/:postId/replies/:replyId/moderate', authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const { status } = req.body;
    const post = await DiscussionPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const reply = post.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ error: 'Reply not found' });

    reply.status = status;
    await post.save();
    res.json({ post });
  } catch (err) { next(err); }
});

module.exports = router;
