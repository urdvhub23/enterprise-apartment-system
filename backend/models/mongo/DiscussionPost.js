const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  authorId: { type: String, required: true },
  authorName: String,
  body: { type: String, required: true },
  status: { type: String, enum: ['visible', 'flagged', 'removed'], default: 'visible' }
}, { timestamps: true });

// Community discussion board. Moderation is opt-in per society (a
// property_manager/staff can flag or remove any post/reply); nothing here
// auto-publishes to the public internet — it's scoped to logged-in residents
// of one society via societyId.
const discussionPostSchema = new mongoose.Schema({
  societyId: { type: String, required: true, index: true },
  authorId: { type: String, required: true },
  authorName: String,
  title: { type: String, required: true },
  body: { type: String, required: true },
  category: {
    type: String,
    enum: ['general', 'events', 'buy_sell', 'lost_found', 'recommendations'],
    default: 'general'
  },
  status: { type: String, enum: ['visible', 'flagged', 'removed'], default: 'visible' },
  replies: [replySchema]
}, { timestamps: true });

module.exports = mongoose.model('DiscussionPost', discussionPostSchema);
