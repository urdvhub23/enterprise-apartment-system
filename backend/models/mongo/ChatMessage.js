const mongoose = require('mongoose');

// Tenant <-> staff support chat threads.
const chatMessageSchema = new mongoose.Schema({
  threadId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderRole: { type: String, enum: ['tenant', 'staff', 'property_manager'], required: true },
  message: { type: String, required: true },
  readBy: [String]
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
