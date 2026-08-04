const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  category: {
    type: String,
    enum: ['general', 'maintenance', 'event', 'billing', 'emergency'],
    default: 'general'
  },
  postedByStaffId: { type: String, required: true },
  targetBuildings: [String], // empty = all buildings
  pinned: { type: Boolean, default: false },
  expiresAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema);
