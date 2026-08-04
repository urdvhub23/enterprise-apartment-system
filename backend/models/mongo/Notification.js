const mongoose = require('mongoose');

// Fire-and-forget notification records (push/email/SMS log), high write volume,
// flexible payload per notification type -> good fit for Mongo rather than Postgres.
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  channel: { type: String, enum: ['push', 'email', 'sms', 'in_app'], required: true },
  type: {
    type: String,
    enum: ['rent_due', 'rent_overdue', 'complaint_update', 'notice_posted', 'chat_message', 'payment_received'],
    required: true
  },
  title: String,
  body: String,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
