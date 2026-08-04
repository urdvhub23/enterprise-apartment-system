const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  authorId: { type: String, required: true },
  authorName: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Complaints/maintenance tickets: variable fields per category (plumbing,
// electrical, security, etc.), unstructured comments/photos — good fit for Mongo.
const complaintSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true }, // FK reference to Postgres users.id
  apartmentId: { type: String, required: true, index: true }, // FK reference to Postgres apartments.id
  category: {
    type: String,
    enum: ['plumbing', 'electrical', 'security', 'cleaning', 'appliance', 'noise', 'other'],
    required: true
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  photoUrls: [String],
  assignedStaffId: { type: String, default: null },
  comments: [commentSchema],
  resolvedAt: Date,

  // --- SLA / escalation (Committees & Enterprise Administrators feature) ---
  // slaHours is set from a per-category default at creation time (see
  // complaints.routes.js SLA_HOURS_BY_CATEGORY). A cron job compares
  // slaDueAt against now and escalates unresolved tickets automatically.
  slaHours: { type: Number, default: 48 },
  slaDueAt: { type: Date },
  escalated: { type: Boolean, default: false },
  escalationLevel: { type: Number, default: 0 }, // 0 = not escalated, 1 = committee notified, 2+ = further escalation
  escalatedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
